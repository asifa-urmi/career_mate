import { afterEach, describe, expect, it } from 'vitest'
import { fallbackReason, unavailableMessage } from '@/lib/ai/providers/mock'

/**
 * Why the assistant is unavailable, said accurately.
 *
 * The message was always "every configured provider is rate limited or out of
 * quota". When no provider is configured at all — no key anywhere, which is what
 * a fresh deployment looks like — that sentence sends whoever runs the site
 * hunting for a quota problem that does not exist, while the real answer is that
 * a key never reached the server.
 *
 * The two cases need different words because they need different actions.
 */

const KEYS = ['GOOGLE_AI_API_KEY', 'GROQ_API_KEY', 'MISTRAL_API_KEY', 'OPENROUTER_API_KEY']

afterEach(() => {
  for (const key of KEYS) delete process.env[key]
})

describe('fallbackReason', () => {
  it('is "unconfigured" when no provider has a key', () => {
    expect(fallbackReason()).toBe('unconfigured')
  })

  it('is "exhausted" once any provider has a key', () => {
    process.env.GROQ_API_KEY = 'gsk_test'

    expect(fallbackReason()).toBe('exhausted')
  })

  // An empty string is what a variable added to the dashboard and left blank
  // looks like, and it is the commonest way to think a key is set when it is not.
  it('treats an empty key as no key', () => {
    process.env.OPENROUTER_API_KEY = ''

    expect(fallbackReason()).toBe('unconfigured')
  })

  it('treats whitespace as no key', () => {
    process.env.MISTRAL_API_KEY = '   '

    expect(fallbackReason()).toBe('unconfigured')
  })
})

describe('unavailableMessage', () => {
  it('names the missing configuration when there is none', () => {
    const message = unavailableMessage()

    expect(message).toMatch(/no AI provider is configured/i)
    expect(message).not.toMatch(/quota/i)
  })

  it('names the quota when providers exist but could not answer', () => {
    process.env.GEMINI_KEY_UNUSED = 'x'
    process.env.GROQ_API_KEY = 'gsk_test'

    const message = unavailableMessage()

    expect(message).toMatch(/rate limited or out of quota/i)
    delete process.env.GEMINI_KEY_UNUSED
  })

  // Whichever branch it takes, it must never read as a real answer.
  it('always says it is not model output', () => {
    expect(unavailableMessage()).toMatch(/not model output/i)

    process.env.GROQ_API_KEY = 'gsk_test'
    expect(unavailableMessage()).toMatch(/not model output/i)
  })
})
