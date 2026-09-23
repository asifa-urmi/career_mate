import { z } from 'zod'

/**
 * What each structured feature must get back.
 *
 * A response that does not parse is a retryable failure, so a model that ignores
 * the format instruction fails over to the next provider instead of rendering a
 * broken panel — or worse, being stored and shown later as if it were valid.
 *
 * `unavailable` is how the fallback identifies itself. Every schema accepts it so
 * the fallback's answer validates like any other, and the UI branches on it
 * rather than on which provider happened to serve the request.
 */

const base = { unavailable: z.boolean().optional() }

export const matchExplanationSchema = z.object({
  ...base,
  summary: z.string().max(600),
  strengths: z.array(z.string().max(300)).max(6).default([]),
  gaps: z.array(z.string().max(300)).max(6).default([]),
})
export type MatchExplanation = z.infer<typeof matchExplanationSchema>

export const cvReviewSchema = z.object({
  ...base,
  summary: z.string().max(800),
  suggestions: z
    .array(
      z.object({
        area: z.string().max(80),
        suggestion: z.string().max(400),
      }),
    )
    .max(8)
    .default([]),
})
export type CvReview = z.infer<typeof cvReviewSchema>

export const coverLetterSchema = z.object({
  ...base,
  draft: z.string().max(3000),
})
export type CoverLetter = z.infer<typeof coverLetterSchema>

export const interviewQuestionsSchema = z.object({
  ...base,
  questions: z
    .array(
      z.object({
        question: z.string().max(400),
        whatTheyAreLookingFor: z.string().max(400),
      }),
    )
    .max(10)
    .default([]),
})
export type InterviewQuestions = z.infer<typeof interviewQuestionsSchema>

export const coachReplySchema = z.object({
  ...base,
  reply: z.string().max(3000),
})
export type CoachReply = z.infer<typeof coachReplySchema>
