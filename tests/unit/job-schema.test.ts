import { describe, expect, it } from 'vitest'
import { jobSchema } from '@/lib/validation/job.schema'

const valid = {
  title: 'Accounts Officer',
  category: 'FINANCE',
  location: 'Dhaka',
  workMode: 'ONSITE',
  jobType: 'FULL_TIME',
  summary: 'Maintain accounts and support month-end closing.',
  responsibilities: ['Record daily transactions'],
  requirements: ['BBA in Accounting'],
  requiredSkills: ['Excel'],
  preferredSkills: [],
  screeningQuestions: [],
}

describe('jobSchema', () => {
  it('accepts a complete job', () => {
    expect(jobSchema.safeParse(valid).success).toBe(true)
  })

  // Review Focus 4
  it('refuses a salary range whose minimum exceeds its maximum', () => {
    const r = jobSchema.safeParse({ ...valid, salaryMinBdt: 90000, salaryMaxBdt: 40000 })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('salaryMinBdt'))).toBe(true)
    }
  })

  it('accepts a range where the minimum equals the maximum', () => {
    expect(jobSchema.safeParse({ ...valid, salaryMinBdt: 40000, salaryMaxBdt: 40000 }).success).toBe(
      true,
    )
  })

  it('accepts an open-ended minimum with no maximum', () => {
    expect(jobSchema.safeParse({ ...valid, salaryMinBdt: 40000 }).success).toBe(true)
  })

  // Review Focus 4
  it('refuses an empty responsibilities list', () => {
    const r = jobSchema.safeParse({ ...valid, responsibilities: [] })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(['responsibilities'])
  })

  it('drops blank lines from a list rather than storing empty bullets', () => {
    const r = jobSchema.safeParse({
      ...valid,
      responsibilities: ['Record transactions', '   ', '', 'Reconcile accounts'],
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.responsibilities).toEqual([
      'Record transactions',
      'Reconcile accounts',
    ])
  })

  it('refuses a title under three characters', () => {
    expect(jobSchema.safeParse({ ...valid, title: 'HR' }).success).toBe(false)
  })

  it('refuses a category outside the enum', () => {
    expect(jobSchema.safeParse({ ...valid, category: 'ASTROLOGY' }).success).toBe(false)
  })

  it('refuses a summary that is too short to tell anyone anything', () => {
    expect(jobSchema.safeParse({ ...valid, summary: 'Good job' }).success).toBe(false)
  })

  it('caps screening questions at ten', () => {
    const eleven = Array.from({ length: 11 }, (_, i) => `Question ${i}`)
    expect(jobSchema.safeParse({ ...valid, screeningQuestions: eleven }).success).toBe(false)
  })

  it('caps a screening question at 200 characters', () => {
    expect(
      jobSchema.safeParse({ ...valid, screeningQuestions: ['x'.repeat(201)] }).success,
    ).toBe(false)
  })

  it('de-duplicates skills case-insensitively, keeping the first spelling', () => {
    const r = jobSchema.safeParse({ ...valid, requiredSkills: ['Excel', 'excel', 'EXCEL', 'SQL'] })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.requiredSkills).toEqual(['Excel', 'SQL'])
  })

  it('refuses a negative salary', () => {
    expect(jobSchema.safeParse({ ...valid, salaryMinBdt: -1 }).success).toBe(false)
  })

  // The form posts these; accepting them would let a client publish its own job
  // and skip moderation. They are set by the service, not the payload.
  it('ignores status and moderation if the payload supplies them', () => {
    const r = jobSchema.safeParse({ ...valid, status: 'PUBLISHED', moderation: 'APPROVED' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect('status' in r.data).toBe(false)
      expect('moderation' in r.data).toBe(false)
    }
  })
})
