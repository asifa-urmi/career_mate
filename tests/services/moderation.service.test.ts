import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionUser } from '@/lib/auth/session'

const updateJob = vi.fn()
const createNotification = vi.fn()
const findJob = vi.fn()

const tx = {
  job: { updateMany: updateJob, findFirst: findJob },
  notification: { create: createNotification },
}

vi.mock('@/lib/db/prisma', () => ({
  prisma: { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) },
}))

const { moderateJob } = await import('@/server/services/moderation.service')

function user(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'uid-admin',
    email: 'ad@min.com',
    name: 'Ad',
    avatarUrl: null,
    role: 'ADMIN',
    onboardedAt: new Date(),
    onboarded: true,
    ...overrides,
  }
}

beforeEach(() => {
  for (const m of [updateJob, createNotification, findJob]) m.mockReset()
  findJob.mockResolvedValue({
    id: 'job-1',
    title: 'Accounts Officer',
    moderation: 'PENDING',
    postedById: 'uid-emp',
  })
  updateJob.mockResolvedValue({ count: 1 })
  createNotification.mockResolvedValue({ id: 'n-1' })
})

describe('moderateJob', () => {
  // Without this there is no gatekeeper at all: createJobPosting forces
  // moderation PENDING, every candidate-facing read requires APPROVED, and
  // nothing in the application could ever set it. Every employer-created role
  // was invisible forever, and the loop only worked on seeded jobs.
  it('approves a pending job', async () => {
    const result = await moderateJob(user(), 'job-1', 'APPROVED')

    expect(result.ok).toBe(true)
    expect(updateJob.mock.calls[0]?.[0]?.data?.moderation).toBe('APPROVED')
  })

  it('flags and removes too', async () => {
    await moderateJob(user(), 'job-1', 'FLAGGED', 'Misleading salary')
    expect(updateJob.mock.calls[0]?.[0]?.data?.moderation).toBe('FLAGGED')

    updateJob.mockClear()
    await moderateJob(user(), 'job-1', 'REMOVED', 'Not a real role')
    expect(updateJob.mock.calls[0]?.[0]?.data?.moderation).toBe('REMOVED')
  })

  it('refuses an employer, who would otherwise approve their own listing', async () => {
    const result = await moderateJob(user({ role: 'EMPLOYER' }), 'job-1', 'APPROVED')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN')
    expect(updateJob).not.toHaveBeenCalled()
  })

  it('refuses a candidate', async () => {
    const result = await moderateJob(user({ role: 'CANDIDATE' }), 'job-1', 'APPROVED')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN')
  })

  it('refuses to set moderation back to PENDING, which is not a decision', async () => {
    const result = await moderateJob(user(), 'job-1', 'PENDING')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION')
    expect(updateJob).not.toHaveBeenCalled()
  })

  it('reports a job that does not exist as not found', async () => {
    findJob.mockResolvedValue(null)

    const result = await moderateJob(user(), 'nope', 'APPROVED')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
    expect(updateJob).not.toHaveBeenCalled()
  })

  it('is a no-op when the decision has not changed', async () => {
    findJob.mockResolvedValue({
      id: 'job-1',
      title: 'Accounts Officer',
      moderation: 'APPROVED',
      postedById: 'uid-emp',
    })

    const result = await moderateJob(user(), 'job-1', 'APPROVED')

    expect(result.ok).toBe(true)
    expect(updateJob).not.toHaveBeenCalled()
    expect(createNotification).not.toHaveBeenCalled()
  })

  // The employer needs to know, and the notification is written in the same
  // transaction so it cannot exist for a decision that rolled back.
  it('notifies whoever posted the job, in the same transaction', async () => {
    await moderateJob(user(), 'job-1', 'APPROVED')

    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'uid-emp', type: 'SYSTEM' }),
      }),
    )
    expect(createNotification.mock.calls[0]?.[0]?.data?.body).toContain('Accounts Officer')
  })

  it('passes the moderator reason to the employer so a removal is actionable', async () => {
    await moderateJob(user(), 'job-1', 'REMOVED', 'Salary range is misleading')

    expect(createNotification.mock.calls[0]?.[0]?.data?.body).toContain(
      'Salary range is misleading',
    )
  })
})
