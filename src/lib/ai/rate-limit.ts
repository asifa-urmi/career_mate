/**
 * How often one person may ask the assistant.
 *
 * The provider keys are a single free tier shared by everyone on the deployment.
 * The cooldowns in `cooldown.ts` react to a provider that has already refused —
 * they do not stop one account from getting it there. Without this, a signed-in
 * candidate looping one action a few hundred times exhausts Gemini, then Groq,
 * then Mistral, then OpenRouter, and every other user on the platform sees the
 * "Not AI-generated" fallback for the next quarter of an hour, or the rest of
 * the day.
 *
 * Counted against the interaction log, which is written for every request and is
 * therefore the one record that already exists. Per feature rather than in
 * total, so somebody drafting several cover letters does not lose their
 * interview prep.
 */

import type { AiFeature } from './types'

export const RATE_WINDOW_MS = 60 * 60 * 1000

/**
 * Requests allowed per feature per hour.
 *
 * Generous enough that ordinary use never meets it: revising a cover letter ten
 * times in an hour is real behaviour, asking for it two hundred times is not.
 * The coach is a conversation, so it gets the most.
 */
export const RATE_LIMITS: Record<AiFeature, number> = {
  'match-explain': 40,
  'cv-review': 15,
  'cover-letter': 20,
  'interview-questions': 20,
  'coach-chat': 60,
}

/** Whether a further request is allowed, given how many are already in the window. */
export function withinLimit(feature: AiFeature, used: number): boolean {
  return used < RATE_LIMITS[feature]
}

/** The start of the window a count should be taken over. */
export function windowStart(now: Date): Date {
  return new Date(now.getTime() - RATE_WINDOW_MS)
}

/**
 * What the person is told.
 *
 * Names the limit and roughly when it lifts. A bare "too many requests" leaves
 * someone refreshing, which is the behaviour the limit exists to discourage.
 */
export function rateLimitMessage(feature: AiFeature): string {
  return `You have used your ${RATE_LIMITS[feature]} requests for this hour. The assistant is on a shared free allowance, so it is rationed. Try again in a little while.`
}
