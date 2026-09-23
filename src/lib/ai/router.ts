import {
  AiProviderError,
  isRetryable,
  type AiFailure,
  type AiFailureReason,
  type AiOutcome,
  type AiProvider,
  type AiRequest,
} from './types'
import { COOLDOWN_MS, isAvailable, markUnavailable } from './cooldown'
import { mockProvider } from './providers/mock'
import { ALL_PROVIDERS } from './providers'

/**
 * Works out what a provider's failure means, without every adapter having to
 * agree on an error shape.
 *
 * Providers report the same conditions in different ways — a status code here, a
 * message there, an SDK error class somewhere else. The one distinction that
 * matters is whether the next provider would do better.
 */
export function classifyError(error: unknown): AiFailureReason {
  if (error instanceof AiProviderError) return error.reason

  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status: unknown }).status)
      : undefined

  if (status === 429) return 'rate_limited'
  if (status === 402 || status === 403) return 'quota'
  if (status !== undefined && status >= 500) return 'server'

  const name = error instanceof Error ? error.name : ''
  if (name === 'AbortError' || name === 'TimeoutError') return 'timeout'

  const message = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase()

  if (message.includes('quota') || message.includes('billing') || message.includes('credit')) {
    return 'quota'
  }
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return 'rate_limited'
  }
  if (message.includes('timeout') || message.includes('timed out')) return 'timeout'
  if (message.includes('fetch failed') || message.includes('network') || message.includes('econn')) {
    return 'network'
  }
  if (message.includes('safety') || message.includes('content policy') || message.includes('blocked')) {
    return 'refused'
  }

  // Unknown is retryable: an unrecognised failure from one provider says
  // nothing about the next, and the chain ends at a fallback that cannot fail.
  return 'unknown'
}

/**
 * Models are fond of wrapping JSON in a markdown fence even when told not to.
 * Stripping it is not leniency about malformed output — the JSON inside either
 * parses or it does not.
 */
function unfence(text: string): string {
  const fenced = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/.exec(text)
  return (fenced?.[1] ?? text).trim()
}

/** An answer is only usable if it is non-empty, and parseable when JSON was asked for. */
function validate(text: string, wantsJson: boolean): { ok: true; text: string } | { ok: false } {
  const trimmed = wantsJson ? unfence(text) : text.trim()
  if (!trimmed) return { ok: false }

  if (wantsJson) {
    try {
      JSON.parse(trimmed)
    } catch {
      return { ok: false }
    }
  }

  return { ok: true, text: trimmed }
}

function cooldownFor(reason: AiFailureReason): number | undefined {
  if (reason === 'rate_limited') return COOLDOWN_MS.rate_limited
  if (reason === 'quota') return COOLDOWN_MS.quota
  // A 5xx or a dropped connection is about this moment, not this provider's
  // credit. Benching it would cost capacity for a blip.
  return undefined
}

/**
 * Tries each configured provider in order until one answers.
 *
 * The chain always ends at `mockProvider`, which cannot fail, so this never
 * throws and never returns nothing. `usedFallback` tells the caller the answer
 * did not come from a model, and the UI says so rather than passing it off.
 *
 * Every failure is recorded and returned, so an operator can see *why* they
 * ended up on the fallback instead of guessing.
 */
export async function completeWithFailover(
  request: AiRequest,
  providers: AiProvider[] = orderedProviders(),
): Promise<AiOutcome> {
  const attempts: AiFailure[] = []

  for (const provider of providers) {
    if (!provider.isConfigured()) continue
    if (provider.id !== mockProvider.id && !isAvailable(provider.id)) continue

    try {
      const response = await provider.complete(request)
      const checked = validate(response.text, Boolean(request.json))

      if (!checked.ok) {
        attempts.push({
          providerId: provider.id,
          reason: 'malformed',
          message: request.json
            ? 'Response was not valid JSON'
            : 'Response was empty',
          retryable: true,
        })
        continue
      }

      return {
        response: { ...response, text: checked.text },
        attempts,
        usedFallback: provider.id === mockProvider.id,
      }
    } catch (error) {
      const reason = classifyError(error)
      const retryable = isRetryable(reason)

      attempts.push({
        providerId: provider.id,
        reason,
        message: error instanceof Error ? error.message : String(error),
        retryable,
      })

      const cooldown = cooldownFor(reason)
      if (cooldown) markUnavailable(provider.id, cooldown)

      // A content refusal is about the request, not the provider. Walking the
      // rest of the chain would burn every quota to be refused every time.
      if (!retryable) break
    }
  }

  // Unreachable in practice: the mock is always configured and never throws.
  // Kept explicit so a future reordering that drops it fails loudly here rather
  // than returning undefined into a feature.
  const fallback = await mockProvider.complete(request)
  return { response: fallback, attempts, usedFallback: true }
}

/** The default order: most generous free tier first, fallback last. */
export const DEFAULT_PROVIDER_ORDER = ['gemini', 'groq', 'mistral', 'openrouter', 'mock'] as const

let registry: AiProvider[] | null = null

/** Overridable so tests can inject providers without touching the real adapters. */
export function registerProviders(providers: AiProvider[] | null): void {
  registry = providers
}

export function orderedProviders(): AiProvider[] {
  const available = registry ?? ALL_PROVIDERS
  const configured = process.env.AI_PROVIDER_ORDER?.split(',')
    .map((id) => id.trim())
    .filter(Boolean)

  const order = configured?.length ? configured : [...DEFAULT_PROVIDER_ORDER]
  const byId = new Map(available.map((p) => [p.id, p]))

  const ordered = order.flatMap((id) => {
    const provider = byId.get(id)
    return provider ? [provider] : []
  })

  // The fallback is appended whatever the configured order says, so a typo in
  // AI_PROVIDER_ORDER cannot leave the chain with no floor.
  if (!ordered.some((p) => p.id === mockProvider.id)) ordered.push(mockProvider)

  return ordered
}
