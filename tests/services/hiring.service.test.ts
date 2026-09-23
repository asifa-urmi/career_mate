import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionUser } from '@/lib/auth/session'

const findEmployer = vi.fn()
const findApplication = vi.fn()
const updateApplication = vi.fn()
const createEvent = vi.fn()
const createNotification = vi.fn()
const findRecipient = vi.fn()

const tx = {
  application: { findFirst: findApplication, update: updateApplication },
  applicationEvent: { create: createEvent },
  notification: { create: createNotification },
  user: { findUnique: findRecipient },
}

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    employerProfile: { findUnique: findEmployer },
    $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
  },
}))

const { changeApplicationStage } = await import('@/server/services/hiring.service')

function user(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'uid-emp',
    email: 'e@f.com',
    name: 'E',
    role: 'EMPLOYER',
    onboardedAt: new Date(),
    onboarded: true,
    ...overrides,
  }
}

beforeEach(() => {
  findRecipient.mockReset()
  findRecipient.mockResolvedValue({ notifyOn: ['APPLICATION_UPDATE'] })
  for (const m of [findEmployer, findApplication, updateApplication, createEvent, createNotification]) {
    m.mockReset()
  }
  findEmployer.mockResolvedValue({ companyId: 'co-1' })
  findApplication.mockResolvedValue({
    id: 'app-1',
    stage: 'APPLIED',
    candidateProfile: { userId: 'uid-cand' },
    job: { id: 'job-1', title: 'Accounts Officer', company: { name: 'Meridian Group' } },
  })
  updateApplication.mockResolvedValue({ id: 'app-1' })
  createEvent.mockResolvedValue({ id: 'ev-1' })
  createNotification.mockResolvedValue({ id: 'n-1' })
})

describe('changeApplicationStage', () => {
  it('moves an application belonging to the caller company', async () => {
    const result = await changeApplicationStage(user(), 'app-1', 'INTERVIEW')

    expect(result.ok).toBe(true)
    expect(updateApplication.mock.calls[0]?.[0]?.data?.stage).toBe('INTERVIEW')
  })

  // Review Focus 2: posting another company's application id to the action.
  it('refuses an application belonging to another company and writes nothing', async () => {
    findApplication.mockResolvedValue(null)

    const result = await changeApplicationStage(user(), 'someone-elses', 'OFFER')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
    expect(updateApplication).not.toHaveBeenCalled()
    expect(createEvent).not.toHaveBeenCalled()
    expect(createNotification).not.toHaveBeenCalled()
  })

  it('puts the company predicate in the where clause, not a check after fetching', async () => {
    await changeApplicationStage(user(), 'app-1', 'INTERVIEW')

    expect(findApplication.mock.calls[0]?.[0]?.where).toMatchObject({
      id: 'app-1',
      job: { companyId: 'co-1' },
    })
  })

  it('refuses a candidate', async () => {
    const result = await changeApplicationStage(user({ role: 'CANDIDATE' }), 'app-1', 'OFFER')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN')
    expect(findApplication).not.toHaveBeenCalled()
  })

  it('refuses an employer with no company', async () => {
    findEmployer.mockResolvedValue(null)

    const result = await changeApplicationStage(user(), 'app-1', 'OFFER')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
  })

  // Every change writes an event carrying who made it. The tracker and the audit
  // trail both depend on it; a stage that moved without one is data loss.
  it('records the transition with the acting employer', async () => {
    await changeApplicationStage(user(), 'app-1', 'INTERVIEW', 'Scheduled for Tuesday')

    expect(createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          applicationId: 'app-1',
          fromStage: 'APPLIED',
          toStage: 'INTERVIEW',
          note: 'Scheduled for Tuesday',
          actorId: 'uid-emp',
        }),
      }),
    )
  })

  // Re-submitting the same stage — a double-clicked button — must not litter the
  // history with identical entries or send a second notification.
  it('is a no-op when the stage is unchanged', async () => {
    const result = await changeApplicationStage(user(), 'app-1', 'APPLIED')

    expect(result.ok).toBe(true)
    expect(createEvent).not.toHaveBeenCalled()
    expect(updateApplication).not.toHaveBeenCalled()
    expect(createNotification).not.toHaveBeenCalled()
  })

  it('refuses to reopen an application the candidate withdrew', async () => {
    findApplication.mockResolvedValue({
      id: 'app-1',
      stage: 'WITHDRAWN',
      candidateProfile: { userId: 'uid-cand' },
      job: { id: 'job-1', title: 'Accounts Officer', company: { name: 'Meridian Group' } },
    })

    const result = await changeApplicationStage(user(), 'app-1', 'INTERVIEW')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('CONFLICT')
    expect(updateApplication).not.toHaveBeenCalled()
  })

  // The notification is written in the same transaction as the change, so one
  // can never exist for a move that rolled back.
  it('notifies the candidate in the same transaction', async () => {
    await changeApplicationStage(user(), 'app-1', 'INTERVIEW')

    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'uid-cand',
          type: 'APPLICATION_UPDATE',
          href: '/tracker',
        }),
      }),
    )
    const body = createNotification.mock.calls[0]?.[0]?.data?.body ?? ''
    expect(body).toContain('Accounts Officer')
  })

  it('refuses a stage outside the enum', async () => {
    const result = await changeApplicationStage(
      user(),
      'app-1',
      'PROMOTED' as unknown as 'OFFER',
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION')
    expect(updateApplication).not.toHaveBeenCalled()
  })

  // WITHDRAWN is the candidate's to set, not the employer's — an employer
  // marking someone as having withdrawn would falsify the record.
  it('refuses an employer setting the stage to WITHDRAWN', async () => {
    const result = await changeApplicationStage(user(), 'app-1', 'WITHDRAWN')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN')
    expect(updateApplication).not.toHaveBeenCalled()
  })
})

/**
 * The settings panel offers a toggle for application updates and said "Saved."
 * while this writer ignored it entirely — only messaging consulted `notifyOn`.
 * Three of the four toggles did nothing at all.
 */
describe('stage-change notifications respect the preference', () => {
  it('writes nothing when the candidate turned application updates off', async () => {
    findRecipient.mockResolvedValue({ notifyOn: ['NEW_MESSAGE'] })

    const result = await changeApplicationStage(user(), 'app-1', 'INTERVIEW')

    expect(result.ok).toBe(true)
    expect(createNotification).not.toHaveBeenCalled()
  })

  // The move itself is not a notification and must happen either way.
  it('still moves the application', async () => {
    findRecipient.mockResolvedValue({ notifyOn: [] })

    await changeApplicationStage(user(), 'app-1', 'INTERVIEW')

    expect(updateApplication).toHaveBeenCalled()
  })

  it('asks about the candidate, not the employer making the change', async () => {
    await changeApplicationStage(user(), 'app-1', 'INTERVIEW')

    expect(findRecipient).toHaveBeenCalledWith({
      where: { id: 'uid-cand' },
      select: { notifyOn: true },
    })
  })
})
