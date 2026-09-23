import { describe, expect, it } from 'vitest'
import { MATCH_WEIGHTS, scoreMatch } from '@/lib/matching/score'
import type { MatchCandidate, MatchJob } from '@/lib/matching/score'

const job: MatchJob = {
  category: 'FINANCE',
  location: 'Dhaka',
  workMode: 'ONSITE',
  jobType: 'FULL_TIME',
  salaryMinBdt: 38000,
  salaryMaxBdt: 55000,
  requiredSkills: ['Accounting', 'Excel', 'VAT/Tax'],
  preferredSkills: ['ERP'],
}

const perfect: MatchCandidate = {
  primarySector: 'FINANCE',
  experienceLevel: 'ONE_TO_THREE',
  location: 'Dhaka',
  skills: ['Accounting', 'Excel', 'VAT/Tax', 'ERP'],
  preference: {
    preferredLocation: 'Dhaka',
    workMode: 'ONSITE',
    jobType: 'FULL_TIME',
    minSalaryBdt: 40000,
  },
}

const empty: MatchCandidate = {
  primarySector: 'OTHER',
  experienceLevel: 'ENTRY',
  location: null,
  skills: [],
  preference: null,
}

describe('MATCH_WEIGHTS', () => {
  // The score is a weighted average. Weights that do not sum to one produce a
  // number that is not a percentage of anything.
  it('sum to exactly one', () => {
    const total = MATCH_WEIGHTS.reduce((sum, d) => sum + d.weight, 0)
    expect(total).toBeCloseTo(1, 10)
  })

  it('give every dimension a label a person can read', () => {
    for (const dimension of MATCH_WEIGHTS) {
      expect(dimension.label.length).toBeGreaterThan(0)
    }
  })
})

describe('scoreMatch', () => {
  it('scores a perfect match at 100', () => {
    expect(scoreMatch(perfect, job).score).toBe(100)
  })

  // A brand-new profile must not read as a 50% match. It must also not be NaN,
  // which is what an average over an empty skill list produces if unguarded.
  it('scores an empty profile low, and never NaN', () => {
    const result = scoreMatch(empty, job)
    expect(Number.isFinite(result.score)).toBe(true)
    expect(result.score).toBeLessThan(35)
    expect(result.score).toBeGreaterThanOrEqual(0)
  })

  it('never returns a score outside 0 to 100', () => {
    for (const candidate of [perfect, empty]) {
      const { score } = scoreMatch(candidate, job)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    }
  })

  it('returns one dimension per weight, each with its own evidence', () => {
    const result = scoreMatch(perfect, job)
    expect(result.dimensions).toHaveLength(MATCH_WEIGHTS.length)
    for (const dimension of result.dimensions) {
      expect(dimension.evidence.length).toBeGreaterThan(0)
      expect(dimension.score).not.toBeNull()
      expect(dimension.score!).toBeGreaterThanOrEqual(0)
      expect(dimension.score!).toBeLessThanOrEqual(100)
    }
  })

  // Skills are typed by two different people; "excel" and "Excel" are the same
  // skill and scoring them as a miss would make the number meaningless.
  it('matches skills regardless of capitalisation or surrounding space', () => {
    const shouting = { ...perfect, skills: ['  ACCOUNTING ', 'excel', 'vat/tax', 'erp'] }
    expect(scoreMatch(shouting, job).score).toBe(scoreMatch(perfect, job).score)
  })

  it('scores partial skill overlap between the extremes', () => {
    const half = { ...perfect, skills: ['Accounting', 'Excel'] }
    const full = scoreMatch(perfect, job).score
    const none = scoreMatch({ ...perfect, skills: [] }, job).score
    const partial = scoreMatch(half, job).score

    expect(partial).toBeGreaterThan(none)
    expect(partial).toBeLessThan(full)
  })

  it('treats a job that asks for no skills as satisfied rather than as a zero', () => {
    const noSkillJob = { ...job, requiredSkills: [], preferredSkills: [] }
    const dimension = scoreMatch(empty, noSkillJob).dimensions.find((d) => d.key === 'skills')
    expect(dimension?.score).toBe(100)
  })

  it('scores a remote job as a location match wherever the candidate is', () => {
    const remote = { ...job, workMode: 'REMOTE' as const, location: 'Remote' }
    const elsewhere = { ...perfect, location: 'Sylhet', preference: null }
    const dimension = scoreMatch(elsewhere, remote).dimensions.find((d) => d.key === 'location')
    expect(dimension?.score).toBe(100)
  })

  it('scores a salary below the candidate floor lower than one above it', () => {
    const wantsMore = {
      ...perfect,
      preference: { ...perfect.preference!, minSalaryBdt: 90000 },
    }
    expect(scoreMatch(wantsMore, job).score).toBeLessThan(scoreMatch(perfect, job).score)
  })

  // Silence is not agreement, but it is not a penalty either. An unanswered
  // dimension is excluded from the average rather than scored well or badly.
  it('marks salary unknown when the candidate stated no preference, and does not penalise it', () => {
    const noPreference = { ...perfect, preference: { ...perfect.preference!, minSalaryBdt: null } }
    const result = scoreMatch(noPreference, job)

    expect(result.dimensions.find((d) => d.key === 'salary')?.score).toBeNull()
    expect(result.score).toBe(100)
    expect(result.confidence).toBeLessThan(1)
  })

  it('marks salary unknown when the job posts none', () => {
    const noSalary = { ...job, salaryMinBdt: null, salaryMaxBdt: null }
    const result = scoreMatch(perfect, noSalary)

    expect(result.dimensions.find((d) => d.key === 'salary')?.score).toBeNull()
    expect(result.score).toBe(100)
  })

  it('reports full confidence when every dimension is known', () => {
    expect(scoreMatch(perfect, job).confidence).toBeCloseTo(1, 10)
  })

  it('reports lower confidence when the profile leaves dimensions unanswered', () => {
    expect(scoreMatch(empty, job).confidence).toBeLessThan(1)
  })

  it('scores the sector dimension lower when the sector differs', () => {
    const other = { ...perfect, primarySector: 'HEALTHCARE' as const }
    const dimension = scoreMatch(other, job).dimensions.find((d) => d.key === 'sector')
    expect(dimension?.score).toBeLessThan(100)
  })

  it('is deterministic', () => {
    expect(scoreMatch(perfect, job)).toEqual(scoreMatch(perfect, job))
  })
})
