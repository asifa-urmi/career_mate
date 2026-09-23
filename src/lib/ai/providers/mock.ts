import type { AiFeature, AiProvider, AiRequest, AiResponse } from '../types'

/**
 * The last provider in the chain, and the only one that cannot be unavailable.
 *
 * Its job is to keep a promise: the app answers even when every free tier is
 * exhausted. What it must not do is pretend — every answer says the assistant is
 * unavailable, and the UI labels it a fallback. A generic-but-plausible reply
 * would be worse than no reply, because someone would act on it.
 *
 * Deterministic on purpose, so tests that exercise a feature end to end compare
 * against a fixed answer.
 */

/**
 * Why the assistant is unavailable, said accurately.
 *
 * "Every configured provider is rate limited or out of quota" was printed even
 * when no provider was configured at all — which is what a fresh deployment
 * looks like — and sent whoever runs the site hunting for a quota problem that
 * did not exist, while the real answer was that a key never reached the server.
 *
 * Two cases, because they need two different actions.
 */
const PROVIDER_KEYS = [
  'GOOGLE_AI_API_KEY',
  'GROQ_API_KEY',
  'MISTRAL_API_KEY',
  'OPENROUTER_API_KEY',
] as const

export function fallbackReason(): 'unconfigured' | 'exhausted' {
  const anyKey = PROVIDER_KEYS.some((key) => (process.env[key] ?? '').trim().length > 0)
  return anyKey ? 'exhausted' : 'unconfigured'
}

export function unavailableMessage(): string {
  return fallbackReason() === 'unconfigured'
    ? 'The AI assistant is not switched on — no AI provider is configured for this site. This is a fallback response, not model output.'
    : 'The AI assistant is unavailable right now — every configured provider is rate limited or out of quota. This is a fallback response, not model output.'
}

function prose(): Record<AiFeature, string> {
  const UNAVAILABLE = unavailableMessage()
  return {
  'match-explain': `${UNAVAILABLE}\n\nThe match score beside this role is still accurate: it is calculated from your profile and the job's requirements, not by the AI, so it does not depend on this. What is missing is the written explanation of it.`,
  'cv-review': `${UNAVAILABLE}\n\nYour CV is safely stored and attached to applications as normal. Come back shortly for the review, or add a provider key.`,
  'cover-letter': `${UNAVAILABLE}\n\nWrite your own for now — a short, specific paragraph about why this role and what you have actually done beats anything generic.`,
  'interview-questions': `${UNAVAILABLE}\n\nIn the meantime: read the role's responsibilities and prepare one concrete example from your own experience for each one.`,
  'coach-chat': `${UNAVAILABLE}\n\nEverything else on CareerMate — searching, applying, tracking — works normally.`,
  }
}

/**
 * Schema-shaped stand-ins for the structured features, so a feature that parses
 * the response through Zod gets something valid rather than failing over into
 * nothing. Each one is empty of claims: no invented strengths, no scores.
 */
function jsonShapes(): Record<AiFeature, unknown> {
  const UNAVAILABLE = unavailableMessage()
  return {
  'match-explain': {
    unavailable: true,
    summary: UNAVAILABLE,
    strengths: [],
    gaps: [],
  },
  'cv-review': {
    unavailable: true,
    summary: UNAVAILABLE,
    suggestions: [],
  },
  'cover-letter': { unavailable: true, draft: prose()['cover-letter'] },
  'interview-questions': { unavailable: true, questions: [] },
  'coach-chat': { unavailable: true, reply: prose()['coach-chat'] },
  }
}

export const mockProvider: AiProvider = {
  id: 'mock',
  label: 'Offline fallback',

  isConfigured() {
    return true
  },

  async complete(request: AiRequest): Promise<AiResponse> {
    const text = request.json
      ? JSON.stringify(jsonShapes()[request.feature])
      : prose()[request.feature]

    return { text, providerId: 'mock' }
  },
}
