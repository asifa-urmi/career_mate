import { z } from 'zod'

/**
 * What each structured feature must get back.
 *
 * A response of the wrong *shape* is a retryable failure, so a model that
 * ignores the format instruction fails over to the next provider instead of
 * rendering a broken panel — or worse, being stored and shown later as if it
 * were valid.
 *
 * Length is a different matter and is trimmed, not rejected. The limits exist
 * so one answer cannot fill a panel; they are not a judgement that the answer
 * was wrong. As hard rejections they turned a good reply that ran one item or
 * forty characters long into "the assistant returned something we could not
 * read" — and a parse failure deliberately does not fail over, since another
 * provider would return the same shape, so a retry produced the same length
 * again and the feature looked broken with every provider healthy.
 *
 * `unavailable` is how the fallback identifies itself. Every schema accepts it
 * so the fallback's answer validates like any other, and the UI branches on it
 * rather than on which provider happened to serve the request.
 */

const base = { unavailable: z.boolean().optional() }

/** A string kept whole up to `max`, then cut. Never a reason to fail a parse. */
const text = (max: number) => z.string().transform((s) => s.slice(0, max))

/** A list kept whole up to `max` items, then cut. */
const list = <T extends z.ZodTypeAny>(item: T, max: number) =>
  z
    .array(item)
    .default([])
    .transform((items) => items.slice(0, max))

export const matchExplanationSchema = z.object({
  ...base,
  summary: text(600),
  strengths: list(text(300), 6),
  gaps: list(text(300), 6),
})
export type MatchExplanation = z.infer<typeof matchExplanationSchema>

export const cvReviewSchema = z.object({
  ...base,
  summary: text(800),
  suggestions: list(
    z.object({
      area: text(80),
      suggestion: text(400),
    }),
    8,
  ),
})
export type CvReview = z.infer<typeof cvReviewSchema>

export const coverLetterSchema = z.object({
  ...base,
  draft: text(3000),
})
export type CoverLetter = z.infer<typeof coverLetterSchema>

export const interviewQuestionsSchema = z.object({
  ...base,
  questions: list(
    z.object({
      question: text(400),
      whatTheyAreLookingFor: text(400),
    }),
    10,
  ),
})
export type InterviewQuestions = z.infer<typeof interviewQuestionsSchema>

export const coachReplySchema = z.object({
  ...base,
  reply: text(3000),
})
export type CoachReply = z.infer<typeof coachReplySchema>
