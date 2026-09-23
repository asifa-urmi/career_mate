import { describe, expect, it } from 'vitest'
import {
  basicsSchema,
  educationSchema,
  experienceSchema,
  linksSchema,
  skillsSchema,
} from '@/lib/validation/profile.schema'

const experience = {
  title: 'Accounts Officer',
  company: 'Meridian Group',
  startDate: '2023-01-01',
  endDate: '2025-06-01',
  isCurrent: false,
  description: 'Month-end close and reconciliations.',
}

describe('experienceSchema', () => {
  it('accepts a finished role', () => {
    expect(experienceSchema.safeParse(experience).success).toBe(true)
  })

  it('accepts a current role with no end date', () => {
    const r = experienceSchema.safeParse({ ...experience, endDate: '', isCurrent: true })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.endDate).toBeUndefined()
  })

  it('refuses an end date before the start date', () => {
    const r = experienceSchema.safeParse({
      ...experience,
      startDate: '2025-01-01',
      endDate: '2023-01-01',
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues.some((i) => i.path.includes('endDate'))).toBe(true)
  })

  it('accepts an end date equal to the start date, for a role that lasted a day', () => {
    expect(
      experienceSchema.safeParse({ ...experience, startDate: '2024-03-01', endDate: '2024-03-01' })
        .success,
    ).toBe(true)
  })

  // Both states cannot be true. Storing an end date on a current role makes the
  // profile read "Present" while the database says otherwise.
  it('refuses a current role that also carries an end date', () => {
    const r = experienceSchema.safeParse({ ...experience, isCurrent: true, endDate: '2025-06-01' })
    expect(r.success).toBe(false)
  })

  it('refuses a finished role with no end date', () => {
    const r = experienceSchema.safeParse({ ...experience, isCurrent: false, endDate: '' })
    expect(r.success).toBe(false)
  })

  it('refuses a start date in the future', () => {
    const nextYear = new Date()
    nextYear.setFullYear(nextYear.getFullYear() + 1)
    const r = experienceSchema.safeParse({
      ...experience,
      startDate: nextYear.toISOString().slice(0, 10),
      isCurrent: true,
      endDate: '',
    })
    expect(r.success).toBe(false)
  })

  it('refuses an empty title or company', () => {
    expect(experienceSchema.safeParse({ ...experience, title: '' }).success).toBe(false)
    expect(experienceSchema.safeParse({ ...experience, company: '  ' }).success).toBe(false)
  })
})

describe('educationSchema', () => {
  it('accepts a degree with no dates, which is common on a first CV', () => {
    expect(
      educationSchema.safeParse({ degree: 'BBA in Accounting', institution: 'Dhaka University' })
        .success,
    ).toBe(true)
  })

  it('refuses an end date before the start date', () => {
    expect(
      educationSchema.safeParse({
        degree: 'BBA',
        institution: 'DU',
        startDate: '2024-01-01',
        endDate: '2020-01-01',
      }).success,
    ).toBe(false)
  })
})

describe('skillsSchema', () => {
  it('splits a comma-separated field', () => {
    const r = skillsSchema.safeParse({ skills: 'Excel, VAT/Tax, Reconciliation' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.skills).toEqual(['Excel', 'VAT/Tax', 'Reconciliation'])
  })

  it('de-duplicates case-insensitively, keeping the first spelling', () => {
    const r = skillsSchema.safeParse({ skills: 'Excel, excel, EXCEL, SQL' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.skills).toEqual(['Excel', 'SQL'])
  })

  it('drops blanks rather than storing empty skills', () => {
    const r = skillsSchema.safeParse({ skills: 'Excel, , ,SQL,' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.skills).toEqual(['Excel', 'SQL'])
  })

  it('caps the list at thirty', () => {
    const many = Array.from({ length: 31 }, (_, i) => `Skill${i}`).join(', ')
    expect(skillsSchema.safeParse({ skills: many }).success).toBe(false)
  })

  it('accepts an empty list, because clearing your skills is allowed', () => {
    const r = skillsSchema.safeParse({ skills: '' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.skills).toEqual([])
  })
})

describe('linksSchema', () => {
  it('accepts a labelled absolute url', () => {
    expect(
      linksSchema.safeParse({ label: 'Portfolio', url: 'https://example.com' }).success,
    ).toBe(true)
  })

  // A bare domain renders as a relative link and navigates inside the app.
  it('refuses a url with no scheme', () => {
    expect(linksSchema.safeParse({ label: 'Portfolio', url: 'example.com' }).success).toBe(false)
  })

  it('refuses a javascript: url', () => {
    expect(
      linksSchema.safeParse({ label: 'x', url: 'javascript:alert(1)' }).success,
    ).toBe(false)
  })

  it('refuses a data: url', () => {
    expect(
      linksSchema.safeParse({ label: 'x', url: 'data:text/html,<script>alert(1)</script>' })
        .success,
    ).toBe(false)
  })
})

describe('basicsSchema', () => {
  it('accepts a complete set of basics', () => {
    expect(
      basicsSchema.safeParse({
        headline: 'Accounts Officer',
        location: 'Dhaka',
        bio: 'Three years in corporate finance.',
        experienceLevel: 'ONE_TO_THREE',
        primarySector: 'FINANCE',
      }).success,
    ).toBe(true)
  })

  it('treats empty optional text as absent rather than storing an empty string', () => {
    const r = basicsSchema.safeParse({
      headline: '',
      location: '',
      bio: '',
      experienceLevel: 'ENTRY',
      primarySector: 'OTHER',
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.headline).toBeUndefined()
      expect(r.data.bio).toBeUndefined()
    }
  })
})
