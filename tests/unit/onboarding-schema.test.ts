import { describe, expect, it } from 'vitest'
import { companySetupSchema, onboardingSchema } from '@/lib/validation/onboarding.schema'

const valid = {
  primarySector: 'TECHNOLOGY',
  experienceLevel: 'ENTRY',
  jobType: 'FULL_TIME',
  workMode: 'ANY',
}

describe('onboardingSchema', () => {
  it('accepts the minimum valid onboarding', () => {
    expect(onboardingSchema.safeParse(valid).success).toBe(true)
  })

  // Review Focus 4: a hand-crafted POST with a sector that is not a category.
  it('refuses a sector outside the category enum', () => {
    const r = onboardingSchema.safeParse({ ...valid, primarySector: 'ASTROLOGY' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(['primarySector'])
  })

  it('refuses a missing sector', () => {
    const { primarySector: _omitted, ...rest } = valid
    expect(onboardingSchema.safeParse(rest).success).toBe(false)
  })

  it('refuses an experience level outside the enum', () => {
    expect(onboardingSchema.safeParse({ ...valid, experienceLevel: 'GURU' }).success).toBe(false)
  })

  it('refuses a negative salary floor', () => {
    expect(onboardingSchema.safeParse({ ...valid, minSalaryBdt: -1 }).success).toBe(false)
  })

  it('coerces a salary submitted as a form string', () => {
    const r = onboardingSchema.safeParse({ ...valid, minSalaryBdt: '35000' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.minSalaryBdt).toBe(35000)
  })

  it('treats an empty salary field as no preference rather than zero', () => {
    const r = onboardingSchema.safeParse({ ...valid, minSalaryBdt: '' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.minSalaryBdt).toBeUndefined()
  })

  it('refuses a salary that is not a number', () => {
    expect(onboardingSchema.safeParse({ ...valid, minSalaryBdt: 'lots' }).success).toBe(false)
  })

  it('refuses an implausibly large salary rather than storing an overflow', () => {
    expect(onboardingSchema.safeParse({ ...valid, minSalaryBdt: 99_000_000_000 }).success).toBe(
      false,
    )
  })

  it('trims an optional target role and drops it when blank', () => {
    const r = onboardingSchema.safeParse({ ...valid, targetRole: '   ' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.targetRole).toBeUndefined()
  })
})

describe('companySetupSchema', () => {
  it('accepts a minimal company', () => {
    expect(
      companySetupSchema.safeParse({ companyName: 'Nexa Labs', sector: 'TECHNOLOGY' }).success,
    ).toBe(true)
  })

  it('refuses a one-character company name', () => {
    expect(companySetupSchema.safeParse({ companyName: 'N', sector: 'TECHNOLOGY' }).success).toBe(
      false,
    )
  })

  it('refuses a website that is not a url', () => {
    const r = companySetupSchema.safeParse({
      companyName: 'Nexa Labs',
      sector: 'TECHNOLOGY',
      website: 'nope',
    })
    expect(r.success).toBe(false)
  })

  it('treats an empty website field as absent rather than an invalid url', () => {
    const r = companySetupSchema.safeParse({
      companyName: 'Nexa Labs',
      sector: 'TECHNOLOGY',
      website: '',
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.website).toBeUndefined()
  })

  it('accepts a real website', () => {
    const r = companySetupSchema.safeParse({
      companyName: 'Nexa Labs',
      sector: 'TECHNOLOGY',
      website: 'https://nexalabs.com',
    })
    expect(r.success).toBe(true)
  })

  it('refuses a sector outside the category enum', () => {
    expect(
      companySetupSchema.safeParse({ companyName: 'Nexa Labs', sector: 'ASTROLOGY' }).success,
    ).toBe(false)
  })
})
