import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionUser } from '@/lib/auth/session'

const findProfile = vi.fn()
const updateExperience = vi.fn()
const createExperience = vi.fn()
const deleteExperienceMany = vi.fn()
const updateEducation = vi.fn()
const createEducation = vi.fn()
const deleteEducationMany = vi.fn()
const updateLink = vi.fn()
const createLink = vi.fn()
const deleteLinkMany = vi.fn()
const deleteSkills = vi.fn()
const createSkills = vi.fn()
const transaction = vi.fn()
const updateProfile = vi.fn()

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    candidateProfile: { findUnique: findProfile, update: updateProfile },
    experience: {
      updateMany: updateExperience,
      create: createExperience,
      deleteMany: deleteExperienceMany,
    },
    education: {
      updateMany: updateEducation,
      create: createEducation,
      deleteMany: deleteEducationMany,
    },
    link: { updateMany: updateLink, create: createLink, deleteMany: deleteLinkMany },
    skill: { deleteMany: deleteSkills, createMany: createSkills },
    $transaction: (ops: unknown[]) => transaction(ops),
  },
}))

const {
  deleteEducation,
  deleteExperience,
  deleteLink,
  setSkills,
  updateBasics,
  upsertEducation,
  upsertExperience,
  upsertLink,
} = await import('@/server/services/profile.service')

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
    updateEducation,
    createEducation,
    deleteEducationMany,
    updateLink,
    createLink,
    deleteLinkMany,
    deleteSkills,
    createSkills,
    transaction,
    updateProfile,
  ]) {
    m.mockReset()
  }
  findProfile.mockResolvedValue({ id: 'cp-1' })
  for (const m of [updateExperience, updateEducation, updateLink]) {
    m.mockResolvedValue({ count: 1 })
  }
  for (const m of [deleteExperienceMany, deleteEducationMany, deleteLinkMany]) {
    m.mockResolvedValue({ count: 1 })
  }
  createExperience.mockResolvedValue({ id: 'exp-1' })
  createEducation.mockResolvedValue({ id: 'edu-1' })
  createLink.mockResolvedValue({ id: 'lnk-1' })
  deleteSkills.mockReturnValue({ count: 0 })
  createSkills.mockReturnValue({ count: 0 })
  transaction.mockResolvedValue([])
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


const education = {
  degree: 'BBA',
  institution: 'DU',
  startDate: undefined,
  endDate: undefined,
}
const link = { label: 'Portfolio', url: 'https://example.com' }

describe('education and link writes carry the same ownership predicate', () => {
  it('scopes an education edit to the caller profile', async () => {
    await upsertEducation(user(), { ...education, id: 'edu-9' })

    expect(updateEducation.mock.calls[0]?.[0]?.where).toMatchObject({
      id: 'edu-9',
      candidateProfileId: 'cp-1',
    })
  })

  it('reports editing another candidate education as not found', async () => {
    updateEducation.mockResolvedValue({ count: 0 })

    const result = await upsertEducation(user(), { ...education, id: 'someone-elses' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
  })

  it('scopes an education delete to the caller profile', async () => {
    await deleteEducation(user(), 'edu-9')

    expect(deleteEducationMany.mock.calls[0]?.[0]?.where).toMatchObject({
      id: 'edu-9',
      candidateProfileId: 'cp-1',
    })
  })

  it('scopes a link edit to the caller profile', async () => {
    await upsertLink(user(), { ...link, id: 'lnk-9' })

    expect(updateLink.mock.calls[0]?.[0]?.where).toMatchObject({
      id: 'lnk-9',
      candidateProfileId: 'cp-1',
    })
  })

  it('reports editing another candidate link as not found', async () => {
    updateLink.mockResolvedValue({ count: 0 })

    const result = await upsertLink(user(), { ...link, id: 'someone-elses' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
  })

  it('scopes a link delete to the caller profile', async () => {
    await deleteLink(user(), 'lnk-9')

    expect(deleteLinkMany.mock.calls[0]?.[0]?.where).toMatchObject({
      id: 'lnk-9',
      candidateProfileId: 'cp-1',
    })
  })

  it('refuses an employer on every entry type', async () => {
    const employer = user({ role: 'EMPLOYER' })

    for (const result of [
      await upsertEducation(employer, education),
      await deleteEducation(employer, 'edu-1'),
      await upsertLink(employer, link),
      await deleteLink(employer, 'lnk-1'),
      await setSkills(employer, { skills: ['Excel'] }),
    ]) {
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('FORBIDDEN')
    }
    expect(createEducation).not.toHaveBeenCalled()
    expect(createLink).not.toHaveBeenCalled()
    expect(transaction).not.toHaveBeenCalled()
  })
})

describe('setSkills', () => {
  // Replaced in one transaction: a diff that failed halfway would leave the
  // profile advertising half its skills.
  it('deletes and recreates in a single transaction scoped to the caller', async () => {
    await setSkills(user(), { skills: ['Excel', 'SQL'] })

    expect(transaction).toHaveBeenCalledTimes(1)
    expect(deleteSkills.mock.calls[0]?.[0]?.where).toMatchObject({ candidateProfileId: 'cp-1' })
    expect(createSkills.mock.calls[0]?.[0]?.data).toEqual([
      { candidateProfileId: 'cp-1', name: 'Excel' },
      { candidateProfileId: 'cp-1', name: 'SQL' },
    ])
  })

  it('clearing every skill is allowed', async () => {
    const result = await setSkills(user(), { skills: [] })

    expect(result.ok).toBe(true)
    expect(createSkills.mock.calls[0]?.[0]?.data).toEqual([])
  })
})
