import { describe, expect, it } from 'vitest'
import {
  coachReplySchema,
  coverLetterSchema,
  cvReviewSchema,
  interviewQuestionsSchema,
  matchExplanationSchema,
} from '@/lib/ai/schemas'

/**
 * Length is trimmed, shape is enforced.
 *
 * These limits exist so one answer cannot fill a panel or a column. They were
 * hard `.max()` rejections, and a rejected parse does not fail over — by
 * design, since a second provider would return the same shape. So a perfectly
 * good answer that ran one item or forty characters long became "the assistant
 * returned something we could not read", with a healthy provider and a
 * retry that produced the same length again. The feature looked broken.
 *
 * Wrong *shape* still fails: a missing field or the wrong type means the model
 * ignored the format, and the next provider is worth trying.
 */
describe('AI response schemas', () => {
  describe('trim rather than reject an answer that runs long', () => {
    it('keeps a 640-character match summary, cut to the limit', () => {
      const result = matchExplanationSchema.safeParse({ summary: 'x'.repeat(640) })

      expect(result.success).toBe(true)
      if (result.success) expect(result.data.summary).toHaveLength(600)
    })

    it('keeps the first six strengths when seven come back', () => {
      const result = matchExplanationSchema.safeParse({
        summary: 'Good fit.',
        strengths: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
        gaps: [],
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.strengths).toHaveLength(6)
        expect(result.data.strengths[0]).toBe('a')
      }
    })

    it('trims an over-long cover letter instead of discarding it', () => {
      const result = coverLetterSchema.safeParse({ draft: 'y'.repeat(3400) })

      expect(result.success).toBe(true)
      if (result.success) expect(result.data.draft).toHaveLength(3000)
    })

    it('trims an over-long coach reply', () => {
      const result = coachReplySchema.safeParse({ reply: 'z'.repeat(3200) })

      expect(result.success).toBe(true)
      if (result.success) expect(result.data.reply).toHaveLength(3000)
    })

    it('trims both the list and the strings inside a CV review', () => {
      const result = cvReviewSchema.safeParse({
        summary: 's'.repeat(900),
        suggestions: Array.from({ length: 11 }, () => ({
          area: 'a'.repeat(120),
          suggestion: 'b'.repeat(500),
        })),
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.summary).toHaveLength(800)
        expect(result.data.suggestions).toHaveLength(8)
        expect(result.data.suggestions[0]?.area).toHaveLength(80)
        expect(result.data.suggestions[0]?.suggestion).toHaveLength(400)
      }
    })

    it('trims twelve interview questions to ten', () => {
      const result = interviewQuestionsSchema.safeParse({
        questions: Array.from({ length: 12 }, (_, i) => ({
          question: `q${i}`,
          whatTheyAreLookingFor: 'clarity',
        })),
      })

      expect(result.success).toBe(true)
      if (result.success) expect(result.data.questions).toHaveLength(10)
    })
  })

  describe('still reject an answer of the wrong shape', () => {
    it('rejects a missing required field', () => {
      expect(matchExplanationSchema.safeParse({ strengths: [] }).success).toBe(false)
    })

    it('rejects the wrong type', () => {
      expect(coverLetterSchema.safeParse({ draft: 42 }).success).toBe(false)
    })

    it('rejects a list item missing half its shape', () => {
      const result = interviewQuestionsSchema.safeParse({
        questions: [{ question: 'Tell me about yourself' }],
      })

      expect(result.success).toBe(false)
    })

    it('rejects a string where a list belongs', () => {
      expect(
        matchExplanationSchema.safeParse({ summary: 'ok', strengths: 'nope' }).success,
      ).toBe(false)
    })
  })

  // The fallback identifies itself this way, and every schema accepts it so the
  // UI branches on the flag rather than on which provider served the request.
  it('accepts the fallback marker on every schema', () => {
    for (const schema of [
      matchExplanationSchema,
      cvReviewSchema,
      coverLetterSchema,
      interviewQuestionsSchema,
      coachReplySchema,
    ]) {
      const parsed = schema.safeParse({
        unavailable: true,
        summary: '',
        draft: '',
        reply: '',
      })

      expect(parsed.success).toBe(true)
    }
  })
})
