import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionUser } from '@/lib/auth/session'

const findCandidateProfile = vi.fn()
const findJob = vi.fn()
const deleteSaved = vi.fn()
const createSaved = vi.fn()

const tx = {
  candidateProfile: { findUnique: findCandidateProfile },
  job: { findFirst: findJob },
  savedJob: { deleteMany: deleteSaved, create: createSaved },
}

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
    candidateProfile: { findUnique: findCandidateProfile },
  },
}))

const { toggleSavedJob } = await import('@/server/services/saved-job.service')

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

beforeEach(() => {
  for (const m of [findCandidateProfile, findJob, deleteSaved, createSaved]) m.mockReset()
  findCandidateProfile.mockResolvedValue({ id: 'cp-1' })
  findJob.mockResolvedValue({ id: 'job-1' })
  deleteSaved.mockResolvedValue({ count: 0 })
  createSaved.mockResolvedValue({ id: 'sj-1' })
})

describe('toggleSavedJob', () => {
  it('saves a job the candidate had not saved', async () => {
    deleteSaved.mockResolvedValue({ count: 0 })

    const result = await toggleSavedJob(user(), 'job-1')

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.saved).toBe(true)
    expect(createSaved).toHaveBeenCalled()
  })

  // Delete-then-maybe-create in one transaction, rather than read-then-branch:
  // a double-clicked save cannot produce two rows or two toggles racing.
  it('un-saves a job the candidate had already saved', async () => {
    deleteSaved.mockResolvedValue({ count: 1 })

    const result = await toggleSavedJob(user(), 'job-1')

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.saved).toBe(false)
    expect(createSaved).not.toHaveBeenCalled()
  })

  it('refuses an employer', async () => {
    const result = await toggleSavedJob(user({ role: 'EMPLOYER' }), 'job-1')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN')
    expect(createSaved).not.toHaveBeenCalled()
    expect(deleteSaved).not.toHaveBeenCalled()
  })

  it('refuses a candidate whose profile row does not exist rather than crashing', async () => {
    findCandidateProfile.mockResolvedValue(null)

    const result = await toggleSavedJob(user(), 'job-1')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
  })

  // Saving an unpublished or closed job would put a row on the saved list that
  // renders nothing, and would confirm that a draft job's id exists.
  it('refuses a job that is not published and approved', async () => {
    findJob.mockResolvedValue(null)

    const result = await toggleSavedJob(user(), 'draft-job')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
    expect(createSaved).not.toHaveBeenCalled()
  })

  it('checks publish state inside the transaction, not before it', async () => {
    await toggleSavedJob(user(), 'job-1')

    const where = findJob.mock.calls[0]?.[0]?.where
    expect(where).toMatchObject({ id: 'job-1', status: 'PUBLISHED', moderation: 'APPROVED' })
  })

  it('scopes the delete to this candidate, so one cannot un-save for another', async () => {
    await toggleSavedJob(user(), 'job-1')

    const where = deleteSaved.mock.calls[0]?.[0]?.where
    expect(where).toMatchObject({ candidateProfileId: 'cp-1', jobId: 'job-1' })
  })
})
