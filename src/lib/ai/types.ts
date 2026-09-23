/**
 * The contract every AI provider implements.
 *
 * Features never name a provider. They build an `AiRequest` and hand it to the
 * router; only the adapters under `providers/` know that Gemini or Groq exists.
 * Adding a provider is one file plus one line of ordering — no feature changes.
 */

export type AiMessage = { role: 'system' | 'user'; content: string }

export type AiRequest = {
  /** Which feature asked. Recorded on the interaction log and used by the mock. */
  feature: AiFeature
  messages: AiMessage[]
  /** When true the provider must return JSON, and the router validates it. */
  json?: boolean
  maxTokens?: number
}

export type AiFeature =
  | 'match-explain'
  | 'cv-review'
  | 'cover-letter'
  | 'interview-questions'
  | 'coach-chat'

export type AiResponse = {
  text: string
  providerId: string
  promptTokens?: number
  completionTokens?: number
}

/**
 * Why a provider did not serve a request.
 *
 * `retryable` is the whole point: a rate limit or an exhausted quota means "ask
 * the next one", a content refusal means "stop, the next one will refuse too".
 * Getting that distinction wrong either burns every provider on one bad request
 * or gives up on the first hiccup.
 */
export type AiFailureReason =
  | 'not_configured'
  | 'rate_limited'
  | 'quota'
  | 'server'
  | 'timeout'
  | 'network'
  | 'malformed'
  | 'refused'
  | 'unknown'

export type AiFailure = {
  providerId: string
  reason: AiFailureReason
  message: string
  retryable: boolean
}

export interface AiProvider {
  id: string
  label: string
  /** True when this provider's key is present. No key simply means fewer providers. */
  isConfigured(): boolean
  complete(request: AiRequest): Promise<AiResponse>
}

export type AiOutcome = {
  response: AiResponse
  /** Every provider that was tried and failed, in order, with why. */
  attempts: AiFailure[]
  /** True when the deterministic local provider answered. The UI says so. */
  usedFallback: boolean
}

/** Thrown by adapters so the router can classify without parsing strings. */
export class AiProviderError extends Error {
  constructor(
    readonly reason: AiFailureReason,
    message: string,
  ) {
    super(message)
    this.name = 'AiProviderError'
  }
}

export function isRetryable(reason: AiFailureReason): boolean {
  // `refused` is a decision about the content, which the next provider would
  // reach too. `not_configured` is not a failure, just an absent provider.
  return reason !== 'refused' && reason !== 'not_configured'
}
