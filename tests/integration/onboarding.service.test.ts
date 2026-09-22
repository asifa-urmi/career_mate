import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionUser } from '@/lib/auth/session'

const findFirstCompany = vi.fn()
const createCompany = vi.fn()
const updateCompany = vi.fn()
const upsertEmployerProfile = vi.fn()
const findEmployerProfile = vi.fn()
const upsertCandidateProfile = vi.fn()
const upsertJobPreference = vi.fn()
const updateUser = vi.fn()

const tx = {
  company: { findFirst: findFirstCompany, create: createCompany, update: updateCompany },
  employerProfile: { upsert: upsertEmployerProfile, findUnique: findEmployerProfile },
  candidateProfile: { upsert: upsertCandidateProfile },
  jobPreference: { upsert: upsertJobPreference },
  user: { update: updateUser },
}

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
  },
}))

const { completeCompanySetup, completeOnboarding } = await import(
  '@/server/services/onboarding.service'
)

function user(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'uid-1',
    email: 'a@b.com',
    name: 'A',
    role: 'CANDIDATE',
    onboardedAt: null,
    onboarded: false,
    ...overrides,
  }
}

const candidateInput = {
  primarySector: 'TECHNOLOGY',
  experienceLevel: 'ENTRY',
  jobType: 'FULL_TIME',
  workMode: 'ANY',
} as const

const companyInput = { companyName: 'Nexa Labs', sector: 'TECHNOLOGY' } as const

beforeEach(() => {
  for (const m of [
    findFirstCompany,
    createCompany,
    updateCompany,
    upsertEmployerProfile,
    findEmployerProfile,
    upsertCandidateProfile,
    upsertJobPreference,
    updateUser,
  ]) {
    m.mockReset()
  }
  upsertCandidateProfile.mockResolvedValue({ id: 'cp-1' })
  createCompany.mockResolvedValue({ id: 'co-1' })
  updateCompany.mockResolvedValue({ id: 'co-1' })
})

describe('completeOnboarding authorization', () => {
  it('accepts a candidate who has not onboarded', async () => {
    const result = await completeOnboarding(user(), candidateInput)
    expect(result.ok).toBe(true)
    expect(updateUser).toHaveBeenCalled()
  })

  // A server action is a public HTTP endpoint reachable by its build-hash id from
  // any session. The layout that normally guards this page is never involved.
  it('refuses an employer, who would get an onboarded stamp and no company', async () => {
    const result = await completeOnboarding(user({ role: 'EMPLOYER' }), candidateInput)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN')
    expect(upsertCandidateProfile).not.toHaveBeenCalled()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('refuses an admin', async () => {
    const result = await completeOnboarding(user({ role: 'ADMIN' }), candidateInput)
    expect(result.ok).toBe(false)
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('refuses a candidate who has already finished onboarding', async () => {
    const result = await completeOnboarding(
      user({ onboarded: true, onboardedAt: new Date() }),
      candidateInput,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('CONFLICT')
    expect(upsertCandidateProfile).not.toHaveBeenCalled()
  })
})

describe('completeCompanySetup authorization', () => {
  it('accepts an employer who has not set up a company', async () => {
    findFirstCompany.mockResolvedValue(null)
    const result = await completeCompanySetup(user({ role: 'EMPLOYER' }), companyInput)
    expect(result.ok).toBe(true)
    expect(createCompany).toHaveBeenCalled()
  })

  it('refuses a candidate', async () => {
    const result = await completeCompanySetup(user({ role: 'CANDIDATE' }), companyInput)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN')
    expect(createCompany).not.toHaveBeenCalled()
    expect(upsertEmployerProfile).not.toHaveBeenCalled()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('refuses an employer who already has a company', async () => {
    const result = await completeCompanySetup(
      user({ role: 'EMPLOYER', onboarded: true, onboardedAt: new Date() }),
      companyInput,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('CONFLICT')
    expect(createCompany).not.toHaveBeenCalled()
  })
})

describe('company claiming', () => {
  // The seeded companies are verified. Letting anyone who types the name attach
  // themselves would hand them a trusted brand to post jobs under.
  it('refuses to auto-join a verified company', async () => {
    findFirstCompany.mockResolvedValue({ id: 'co-1', verified: true })

    const result = await completeCompanySetup(user({ role: 'EMPLOYER' }), companyInput)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN')
    expect(upsertEmployerProfile).not.toHaveBeenCalled()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('joins an unverified company without touching its details', async () => {
    findFirstCompany.mockResolvedValue({ id: 'co-1', verified: false })

    const result = await completeCompanySetup(user({ role: 'EMPLOYER' }), {
      ...companyInput,
      about: 'Overwritten text',
      website: 'https://attacker.example',
    })

    expect(result.ok).toBe(true)
    expect(updateCompany).not.toHaveBeenCalled()
    expect(createCompany).not.toHaveBeenCalled()
    expect(upsertEmployerProfile).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ companyId: 'co-1' }) }),
    )
  })

  it('creates a new company as unverified', async () => {
    findFirstCompany.mockResolvedValue(null)

    await completeCompanySetup(user({ role: 'EMPLOYER' }), companyInput)

    const created = createCompany.mock.calls[0]?.[0]?.data
    expect(created?.verified).toBeFalsy()
    expect(created?.name).toBe('Nexa Labs')
  })

  it('matches an existing company case-insensitively, so casing cannot fork a brand', async () => {
    findFirstCompany.mockResolvedValue(null)

    await completeCompanySetup(user({ role: 'EMPLOYER' }), {
      ...companyInput,
      companyName: 'nexa labs',
    })

    const where = findFirstCompany.mock.calls[0]?.[0]?.where
    expect(where?.name).toEqual({ equals: 'nexa labs', mode: 'insensitive' })
  })
})
