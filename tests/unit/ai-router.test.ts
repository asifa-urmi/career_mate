import { beforeEach, describe, expect, it, vi } from 'vitest'
import { completeWithFailover, classifyError } from '@/lib/ai/router'
import { clearCooldowns, isAvailable, markUnavailable } from '@/lib/ai/cooldown'
import {
  AiProviderError,
  type AiFailureReason,
  type AiProvider,
  type AiRequest,
} from '@/lib/ai/types'
import { mockProvider } from '@/lib/ai/providers/mock'

function request(json = false): AiRequest {
  return {
    feature: 'coach-chat',
    json,
    messages: [{ role: 'user', content: 'hello' }],
  }
}

/** A provider that answers. */
function working(id: string, text = `answer from ${id}`): AiProvider {
  return {
    id,
    label: id,
    isConfigured: () => true,
    complete: vi.fn(async () => ({ text, providerId: id })),
  }
}

/** A provider that fails with a given reason. */
function failing(id: string, reason: AiFailureReason): AiProvider {
  return {
    id,
    label: id,
    isConfigured: () => true,
    complete: vi.fn(async () => {
      throw new AiProviderError(reason, `${id} failed`)
    }),
  }
}

beforeEach(() => {
  clearCooldowns()
})

describe('completeWithFailover', () => {
  it('uses the first provider that answers', async () => {
    const first = working('gemini')
    const second = working('groq')

    const outcome = await completeWithFailover(request(), [first, second, mockProvider])

    expect(outcome.response.providerId).toBe('gemini')
    expect(outcome.attempts).toEqual([])
    expect(outcome.usedFallback).toBe(false)
    expect(second.complete).not.toHaveBeenCalled()
  })

  // Review Focus 2: the whole reason the chain exists.
  it('moves to the next provider when the first is rate limited', async () => {
    const outcome = await completeWithFailover(request(), [
      failing('gemini', 'rate_limited'),
      working('groq'),
      mockProvider,
    ])

    expect(outcome.response.providerId).toBe('groq')
    expect(outcome.attempts).toHaveLength(1)
    expect(outcome.attempts[0]).toMatchObject({ providerId: 'gemini', reason: 'rate_limited' })
  })

  it('moves on for an exhausted quota, a server error, a timeout and a network error', async () => {
    for (const reason of ['quota', 'server', 'timeout', 'network'] as const) {
      clearCooldowns()
      const outcome = await completeWithFailover(request(), [
        failing('gemini', reason),
        working('groq'),
        mockProvider,
      ])
      expect(outcome.response.providerId, reason).toBe('groq')
    }
  })

  // Review Focus 1: no keys at all.
  it('answers from the fallback when every provider fails', async () => {
    const outcome = await completeWithFailover(request(), [
      failing('gemini', 'quota'),
      failing('groq', 'quota'),
      failing('mistral', 'rate_limited'),
      mockProvider,
    ])

    expect(outcome.response.providerId).toBe('mock')
    expect(outcome.usedFallback).toBe(true)
    expect(outcome.attempts).toHaveLength(3)
  })

  it('answers from the fallback when no provider is configured at all', async () => {
    const outcome = await completeWithFailover(request(), [mockProvider])

    expect(outcome.response.providerId).toBe('mock')
    expect(outcome.usedFallback).toBe(true)
  })

  it('skips an unconfigured provider without recording it as a failure', async () => {
    const unconfigured: AiProvider = {
      id: 'mistral',
      label: 'Mistral',
      isConfigured: () => false,
      complete: vi.fn(),
    }

    const outcome = await completeWithFailover(request(), [unconfigured, working('groq'), mockProvider])

    expect(outcome.response.providerId).toBe('groq')
    expect(outcome.attempts).toEqual([])
    expect(unconfigured.complete).not.toHaveBeenCalled()
  })

  // A content refusal is a decision about the request. Trying four more
  // providers would burn four quotas to be refused four more times.
  it('stops the chain on a non-retryable refusal', async () => {
    const second = working('groq')

    const outcome = await completeWithFailover(request(), [
      failing('gemini', 'refused'),
      second,
      mockProvider,
    ])

    expect(outcome.response.providerId).toBe('mock')
    expect(outcome.usedFallback).toBe(true)
    expect(second.complete).not.toHaveBeenCalled()
    expect(outcome.attempts[0]).toMatchObject({ reason: 'refused', retryable: false })
  })

  // Review Focus 3.
  it('treats prose as a failure when JSON was required, and fails over', async () => {
    const prose = working('gemini', 'Sure! Here is my answer in words.')

    const outcome = await completeWithFailover(request(true), [
      prose,
      working('groq', '{"reply":"ok"}'),
      mockProvider,
    ])

    expect(outcome.response.providerId).toBe('groq')
    expect(outcome.attempts[0]).toMatchObject({ providerId: 'gemini', reason: 'malformed' })
  })

  it('accepts JSON wrapped in a markdown fence, which models commonly emit', async () => {
    const fenced = working('gemini', '```json\n{"reply":"ok"}\n```')

    const outcome = await completeWithFailover(request(true), [fenced, mockProvider])

    expect(outcome.response.providerId).toBe('gemini')
    expect(JSON.parse(outcome.response.text)).toEqual({ reply: 'ok' })
  })

  it('does not require JSON when the request did not ask for it', async () => {
    const outcome = await completeWithFailover(request(false), [
      working('gemini', 'plain prose'),
      mockProvider,
    ])

    expect(outcome.response.providerId).toBe('gemini')
  })

  it('treats an empty response as a failure rather than a valid empty answer', async () => {
    const outcome = await completeWithFailover(request(), [
      working('gemini', '   '),
      working('groq'),
      mockProvider,
    ])

    expect(outcome.response.providerId).toBe('groq')
    expect(outcome.attempts[0]).toMatchObject({ reason: 'malformed' })
  })

  // Review Focus 2, second half: an exhausted provider must not be retried on
  // every later request, adding its timeout to each one.
  it('puts a rate-limited provider on cooldown and skips it next time', async () => {
    const gemini = failing('gemini', 'rate_limited')

    await completeWithFailover(request(), [gemini, working('groq'), mockProvider])
    expect(isAvailable('gemini')).toBe(false)

    await completeWithFailover(request(), [gemini, working('groq'), mockProvider])
    expect(gemini.complete).toHaveBeenCalledTimes(1)
  })

  it('does not put a provider on cooldown for a one-off server error', async () => {
    await completeWithFailover(request(), [
      failing('gemini', 'server'),
      working('groq'),
      mockProvider,
    ])

    expect(isAvailable('gemini')).toBe(true)
  })

  it('falls back rather than failing when every provider is on cooldown', async () => {
    markUnavailable('gemini', 60_000)
    markUnavailable('groq', 60_000)

    const outcome = await completeWithFailover(request(), [
      working('gemini'),
      working('groq'),
      mockProvider,
    ])

    expect(outcome.response.providerId).toBe('mock')
  })
})

describe('classifyError', () => {
  it('reads an explicit provider error', () => {
    expect(classifyError(new AiProviderError('quota', 'x'))).toBe('quota')
  })

  it('recognises a 429 from a status field', () => {
    expect(classifyError({ status: 429, message: 'Too Many Requests' })).toBe('rate_limited')
  })

  it('recognises quota exhaustion from the message', () => {
    expect(classifyError(new Error('You exceeded your current quota'))).toBe('quota')
    expect(classifyError(new Error('insufficient_quota'))).toBe('quota')
  })

  it('recognises a 5xx as a server error', () => {
    expect(classifyError({ status: 503 })).toBe('server')
  })

  it('recognises an abort as a timeout', () => {
    expect(classifyError(Object.assign(new Error('aborted'), { name: 'AbortError' }))).toBe(
      'timeout',
    )
  })

  it('recognises a fetch failure as a network error', () => {
    expect(classifyError(new TypeError('fetch failed'))).toBe('network')
  })

  it('falls back to unknown, which is retryable', () => {
    expect(classifyError(new Error('something odd'))).toBe('unknown')
  })
})
