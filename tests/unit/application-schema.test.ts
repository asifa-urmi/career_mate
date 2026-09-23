import { describe, expect, it } from 'vitest'
import { applicationSchema } from '@/lib/validation/application.schema'
import { snapshotAnswers } from '@/server/services/application.service'

const valid = {
  jobId: 'job-1',
  screeningAnswers: { '0': 'Yes' },
  consented: true,
}

describe('applicationSchema', () => {
  it('accepts a minimal application', () => {
    expect(applicationSchema.safeParse(valid).success).toBe(true)
  })

  // A boolean would let an absent checkbox arrive as false and be stored as
  // "they did not consent" rather than rejected. Consent has to be given.
  it('refuses a missing consent checkbox', () => {
    const { consented: _omitted, ...rest } = valid
    const r = applicationSchema.safeParse(rest)
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(['consented'])
  })

  it('refuses an explicit false consent', () => {
    expect(applicationSchema.safeParse({ ...valid, consented: false }).success).toBe(false)
  })

  it('refuses a missing job id', () => {
    expect(applicationSchema.safeParse({ ...valid, jobId: '' }).success).toBe(false)
  })

  it('caps the cover letter', () => {
    expect(
      applicationSchema.safeParse({ ...valid, coverLetter: 'x'.repeat(4001) }).success,
    ).toBe(false)
  })

  it('treats an empty cover letter as absent rather than an empty string', () => {
    const r = applicationSchema.safeParse({ ...valid, coverLetter: '   ' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.coverLetter).toBeUndefined()
  })

  it('treats an empty resume id as absent, so applying without a CV works', () => {
    const r = applicationSchema.safeParse({ ...valid, resumeId: '' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.resumeId).toBeUndefined()
  })

  it('caps an individual answer', () => {
    expect(
      applicationSchema.safeParse({ ...valid, screeningAnswers: { '0': 'x'.repeat(2001) } })
        .success,
    ).toBe(false)
  })

  // A job caps its questions at ten, so twenty thousand fields is not a person.
  it('caps the number of answers at ten', () => {
    const many = Object.fromEntries(
      Array.from({ length: 11 }, (_, i) => [String(i), 'answer']),
    )
    expect(applicationSchema.safeParse({ ...valid, screeningAnswers: many }).success).toBe(false)
  })

  it('defaults to no answers when the field is absent', () => {
    const { screeningAnswers: _omitted, ...rest } = valid
    const r = applicationSchema.safeParse(rest)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.screeningAnswers).toEqual({})
  })
})

describe('snapshotAnswers', () => {
  it('pairs each question with its answer in order', () => {
    expect(snapshotAnswers(['A?', 'B?'], { '0': 'yes', '1': 'no' })).toEqual([
      { question: 'A?', answer: 'yes' },
      { question: 'B?', answer: 'no' },
    ])
  })

  it('keeps a question that was not answered', () => {
    expect(snapshotAnswers(['A?'], {})).toEqual([{ question: 'A?', answer: '' }])
  })

  it('discards answers with no matching question', () => {
    expect(snapshotAnswers(['A?'], { '0': 'yes', '5': 'stray' })).toEqual([
      { question: 'A?', answer: 'yes' },
    ])
  })

  it('trims an answer', () => {
    expect(snapshotAnswers(['A?'], { '0': '  yes  ' })).toEqual([
      { question: 'A?', answer: 'yes' },
    ])
  })

  it('returns nothing when the job asks nothing', () => {
    expect(snapshotAnswers([], { '0': 'unsolicited' })).toEqual([])
  })

  // Two identical questions are a mistake an employer can make; each still gets
  // its own slot rather than collapsing into one.
  it('keeps duplicate questions separate', () => {
    expect(snapshotAnswers(['Same?', 'Same?'], { '0': 'first', '1': 'second' })).toEqual([
      { question: 'Same?', answer: 'first' },
      { question: 'Same?', answer: 'second' },
    ])
  })
})
