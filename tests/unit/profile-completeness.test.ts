import { describe, expect, it } from 'vitest'
import {
  missingProfileSignals,
  PROFILE_SIGNALS,
  profileCompleteness,
} from '@/lib/profile/completeness'

const empty = {
  headline: null,
  location: null,
  bio: null,
  preference: null,
  counts: { experiences: 0, educations: 0, skills: 0, resumes: 0 },
}

const full = {
  headline: 'Accounts Officer',
  location: 'Dhaka',
  bio: 'Three years in corporate finance.',
  preference: { targetRole: 'Accounts Officer', minSalaryBdt: 40000 },
  counts: { experiences: 2, educations: 1, skills: 6, resumes: 1 },
}

describe('profileCompleteness', () => {
  it('is 0 for a profile with nothing filled in', () => {
    expect(profileCompleteness(empty)).toBe(0)
  })

  it('is 100 for a profile with every signal met', () => {
    expect(profileCompleteness(full)).toBe(100)
  })

  it('weights every signal equally', () => {
    const step = Math.round(100 / PROFILE_SIGNALS.length)
    expect(profileCompleteness({ ...empty, headline: 'Anything' })).toBe(step)
  })

  it('counts a section as met regardless of how many rows it has', () => {
    const one = profileCompleteness({ ...empty, counts: { ...empty.counts, skills: 1 } })
    const many = profileCompleteness({ ...empty, counts: { ...empty.counts, skills: 40 } })
    expect(one).toBe(many)
  })

  it('does not count an empty-string headline as filled in', () => {
    expect(profileCompleteness({ ...empty, headline: '' })).toBe(0)
    expect(profileCompleteness({ ...empty, headline: '   ' })).toBe(0)
  })

  it('treats a missing preference row the same as an empty target role', () => {
    const noRow = profileCompleteness(empty)
    const emptyRow = profileCompleteness({
      ...empty,
      preference: { targetRole: null, minSalaryBdt: null },
    })
    expect(noRow).toBe(emptyRow)
  })

  it('never returns a value outside 0-100', () => {
    for (const p of [empty, full]) {
      const value = profileCompleteness(p)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(100)
    }
  })

  it('names each signal, so the UI can tell someone which piece is missing', () => {
    const missing = PROFILE_SIGNALS.filter((s) => !s.met(empty)).map((s) => s.label)
    expect(missing).toHaveLength(PROFILE_SIGNALS.length)
    expect(missing).toContain('Headline')
  })
})

describe('missingProfileSignals', () => {
  it('lists every signal for a profile with nothing filled in', () => {
    expect(missingProfileSignals(empty)).toHaveLength(PROFILE_SIGNALS.length)
  })

  it('lists nothing for a complete profile', () => {
    expect(missingProfileSignals(full)).toHaveLength(0)
  })

  // An ADMIN is admitted to /dashboard by canAccess but has no CandidateProfile.
  // Returning an empty missing-list for an absent profile made the dashboard
  // show "0%" and "Every section is filled in" at the same time.
  it('lists every signal when there is no candidate profile at all', () => {
    expect(missingProfileSignals(null)).toHaveLength(PROFILE_SIGNALS.length)
    expect(profileCompleteness(null)).toBe(0)
  })

  it('gives every missing signal somewhere to go', () => {
    for (const signal of missingProfileSignals(empty)) {
      expect(signal.href.startsWith('/')).toBe(true)
      expect(signal.label.length).toBeGreaterThan(0)
    }
  })
})
