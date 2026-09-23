import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionUser } from '@/lib/auth/session'

const findProfile = vi.fn()
const updateExperience = vi.fn()
const createExperience = vi.fn()
const deleteExperienceMany = vi.fn()
const updateProfile = vi.fn()

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    candidateProfile: { findUnique: findProfile, update: updateProfile },
    experience: {
      updateMany: updateExperience,
      create: createExperience,
      deleteMany: deleteExperienceMany,
    },
  },
}))

const { deleteExperience, updateBasics, upsertExperience } = await import(
  '@/server/services/profile.service'
)

function user(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'uid-1',
    email: 'a@b.com',
    name: 'A',
    role: 'CANDIDATE',
    onboardedAt: new Date(),
    onboarded: true,
    ...overrides,
  }
}

const experience = {
  title: 'Accounts Officer',
  company: 'Meridian Group',
  startDate: new Date('2023-01-01'),
  endDate: new Date('2025-01-01'),
  isCurrent: false,
  description: undefined,
}

beforeEach(() => {
  for (const m of [
    findProfile,
    updateExperience,
    createExperience,
    deleteExperienceMany,
    updateProfile,
  ]) {
    m.mockReset()
  }
  findProfile.mockResolvedValue({ id: 'cp-1' })
  updateExperience.mockResolvedValue({ count: 1 })
  createExperience.mockResolvedValue({ id: 'exp-1' })
  deleteExperienceMany.mockResolvedValue({ count: 1 })
  updateProfile.mockResolvedValue({ id: 'cp-1' })
})

describe('profile writes are scoped to their owner', () => {
  it('creates a new experience against the caller profile', async () => {
    const result = await upsertExperience(user(), experience)

    expect(result.ok).toBe(true)
    expect(createExperience.mock.calls[0]?.[0]?.data).toMatchObject({
      candidateProfileId: 'cp-1',
      title: 'Accounts Officer',
    })
  })

  it('puts the ownership predicate in the where clause when editing', async () => {
    await upsertExperience(user(), { ...experience, id: 'exp-9' })

    expect(updateExperience.mock.calls[0]?.[0]?.where).toMatchObject({
      id: 'exp-9',
      candidateProfileId: 'cp-1',
    })
  })

  // Not FORBIDDEN: a distinguishable refusal tells an attacker which row ids
  // exist on other people's profiles.
  it('reports another candidate entry as not found', async () => {
    updateExperience.mockResolvedValue({ count: 0 })

    const result = await upsertExperience(user(), { ...experience, id: 'someone-elses' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
  })

  it('scopes deletion the same way', async () => {
    await deleteExperience(user(), 'exp-9')

    expect(deleteExperienceMany.mock.calls[0]?.[0]?.where).toMatchObject({
      id: 'exp-9',
      candidateProfileId: 'cp-1',
    })
  })

  it('reports deleting another candidate entry as not found', async () => {
    deleteExperienceMany.mockResolvedValue({ count: 0 })

    const result = await deleteExperience(user(), 'someone-elses')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
  })

  it('refuses an employer', async () => {
    const result = await upsertExperience(user({ role: 'EMPLOYER' }), experience)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN')
    expect(createExperience).not.toHaveBeenCalled()
    expect(findProfile).not.toHaveBeenCalled()
  })

  it('refuses a candidate with no profile row', async () => {
    findProfile.mockResolvedValue(null)

    const result = await updateBasics(user(), {
      headline: 'x',
      location: undefined,
      bio: undefined,
      experienceLevel: 'ENTRY',
      primarySector: 'OTHER',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('turns a database failure into a handled error rather than a crash', async () => {
    createExperience.mockRejectedValue(new Error('connection lost'))

    const result = await upsertExperience(user(), experience)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INTERNAL')
  })
})
