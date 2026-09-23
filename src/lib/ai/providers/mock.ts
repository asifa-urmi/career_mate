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

const UNAVAILABLE =
  'The AI assistant is unavailable right now — every configured provider is rate limited or out of quota. This is a fallback response, not model output.'

const PROSE: Record<AiFeature, string> = {
  'match-explain': `${UNAVAILABLE}\n\nThe match score beside this role is still accurate: it is calculated from your profile and the job's requirements, not by the AI, so it does not depend on this. What is missing is the written explanation of it.`,
  'cv-review': `${UNAVAILABLE}\n\nYour CV is safely stored and attached to applications as normal. Come back shortly for the review, or add a provider key.`,
  'cover-letter': `${UNAVAILABLE}\n\nWrite your own for now — a short, specific paragraph about why this role and what you have actually done beats anything generic.`,
  'interview-questions': `${UNAVAILABLE}\n\nIn the meantime: read the role's responsibilities and prepare one concrete example from your own experience for each one.`,
  'coach-chat': `${UNAVAILABLE}\n\nEverything else on CareerMate — searching, applying, tracking — works normally.`,
}

/**
 * Schema-shaped stand-ins for the structured features, so a feature that parses
 * the response through Zod gets something valid rather than failing over into
 * nothing. Each one is empty of claims: no invented strengths, no scores.
 */
const JSON_SHAPES: Record<AiFeature, unknown> = {
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
  'cover-letter': { unavailable: true, draft: PROSE['cover-letter'] },
  'interview-questions': { unavailable: true, questions: [] },
  'coach-chat': { unavailable: true, reply: PROSE['coach-chat'] },
}

export const mockProvider: AiProvider = {
  id: 'mock',
  label: 'Offline fallback',

  isConfigured() {
    return true
  },

  async complete(request: AiRequest): Promise<AiResponse> {
    const text = request.json
      ? JSON.stringify(JSON_SHAPES[request.feature])
      : PROSE[request.feature]

    return { text, providerId: 'mock' }
  },
}
