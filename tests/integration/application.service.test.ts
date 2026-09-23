import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionUser } from '@/lib/auth/session'

const findProfile = vi.fn()
const findJob = vi.fn()
const findResume = vi.fn()
const createApplication = vi.fn()
const createEvent = vi.fn()
const findApplication = vi.fn()
const updateApplication = vi.fn()

const tx = {
  candidateProfile: { findUnique: findProfile },
  job: { findFirst: findJob },
  resume: { findFirst: findResume },
  application: {
    create: createApplication,
    findFirst: findApplication,
    update: updateApplication,
  },
  applicationEvent: { create: createEvent },
}

vi.mock('@/lib/db/prisma', () => ({
  prisma: { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) },
}))

const { applyToJob, withdrawApplication } = await import('@/server/services/application.service')

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

const input = {
  jobId: 'job-1',
  screeningAnswers: { '0': 'Yes' },
  consented: true as const,
}

/** What Prisma throws when a unique constraint is violated. */
function uniqueViolation() {
  return Object.assign(new Error('Unique constraint failed'), {
    code: 'P2002',
    meta: { target: ['candidateProfileId', 'jobId'] },
  })
}

beforeEach(() => {
  for (const m of [
    findProfile,
    findJob,
    findResume,
    createApplication,
    createEvent,
    findApplication,
    updateApplication,
  ]) {
    m.mockReset()
  }
  findProfile.mockResolvedValue({ id: 'cp-1' })
  findJob.mockResolvedValue({ id: 'job-1', screeningQuestions: ['Why this role?'] })
  findResume.mockResolvedValue({ id: 'res-1' })
  createApplication.mockResolvedValue({ id: 'app-1' })
  createEvent.mockResolvedValue({ id: 'ev-1' })
})

describe('applyToJob', () => {
  it('creates the application and returns its id', async () => {
    const result = await applyToJob(user(), input)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.applicationId).toBe('app-1')
  })

  // The tracker renders the event history. An application whose creation did not
  // write its own APPLIED event has no beginning to show.
  it('writes the APPLIED event in the same transaction as the row', async () => {
    await applyToJob(user(), input)

    expect(createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          applicationId: 'app-1',
          toStage: 'APPLIED',
          fromStage: null,
        }),
      }),
    )
  })

  // Review Focus 1: a double-clicked submit, or a replayed request.
  it('reports a second application as CONFLICT rather than crashing on the constraint', async () => {
    createApplication.mockRejectedValue(uniqueViolation())

    const result = await applyToJob(user(), input)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('CONFLICT')
      expect(result.error.message).toMatch(/already applied/i)
    }
  })

  // Review Focus 3: closed between page load and submit.
  it('refuses a job that is no longer published', async () => {
    findJob.mockResolvedValue(null)

    const result = await applyToJob(user(), input)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND')
      expect(result.error.message).toMatch(/no longer/i)
    }
    expect(createApplication).not.toHaveBeenCalled()
  })

  it('checks the job inside the transaction, with both publish conditions', async () => {
    await applyToJob(user(), input)

    expect(findJob.mock.calls[0]?.[0]?.where).toMatchObject({
      id: 'job-1',
      status: 'PUBLISHED',
      moderation: 'APPROVED',
    })
  })

  it('refuses an employer', async () => {
    const result = await applyToJob(user({ role: 'EMPLOYER' }), input)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN')
    expect(createApplication).not.toHaveBeenCalled()
  })

  it('refuses a candidate with no profile rather than crashing', async () => {
    findProfile.mockResolvedValue(null)

    const result = await applyToJob(user(), input)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
  })

  // Attaching someone else's CV would leak its contents to the employer.
  it('refuses a resume that does not belong to the applicant', async () => {
    findResume.mockResolvedValue(null)

    const result = await applyToJob(user(), { ...input, resumeId: 'someone-elses' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
    expect(createApplication).not.toHaveBeenCalled()
  })

  it('scopes the resume lookup to the applicant, in the where clause', async () => {
    await applyToJob(user(), { ...input, resumeId: 'res-1' })

    expect(findResume.mock.calls[0]?.[0]?.where).toMatchObject({
      id: 'res-1',
      candidateProfileId: 'cp-1',
    })
  })

  it('applies without a CV, because none exist before the CV feature ships', async () => {
    const result = await applyToJob(user(), input)

    expect(result.ok).toBe(true)
    expect(findResume).not.toHaveBeenCalled()
  })

  it('stamps consent rather than trusting the client to have meant it', async () => {
    await applyToJob(user(), input)

    const data = createApplication.mock.calls[0]?.[0]?.data
    expect(data?.consentedAt).toBeInstanceOf(Date)
    expect(data?.stage).toBeUndefined()
  })
})

describe('withdrawApplication', () => {
  beforeEach(() => {
    findApplication.mockResolvedValue({ id: 'app-1', stage: 'INTERVIEW' })
    updateApplication.mockResolvedValue({ id: 'app-1' })
  })

  // Review Focus 5: another candidate's application id.
  it('reports another candidate application as not found, not forbidden', async () => {
    findApplication.mockResolvedValue(null)

    const result = await withdrawApplication(user(), 'someone-elses')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
    expect(updateApplication).not.toHaveBeenCalled()
  })

  it('scopes the lookup to this candidate, in the where clause', async () => {
    await withdrawApplication(user(), 'app-1')

    expect(findApplication.mock.calls[0]?.[0]?.where).toMatchObject({
      id: 'app-1',
      candidateProfileId: 'cp-1',
    })
  })

  it('records the stage it came from, so the history reads correctly', async () => {
    await withdrawApplication(user(), 'app-1')

    expect(createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fromStage: 'INTERVIEW', toStage: 'WITHDRAWN' }),
      }),
    )
  })

  it('refuses to withdraw an already-withdrawn application', async () => {
    findApplication.mockResolvedValue({ id: 'app-1', stage: 'WITHDRAWN' })

    const result = await withdrawApplication(user(), 'app-1')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('CONFLICT')
    expect(createEvent).not.toHaveBeenCalled()
  })

  it('refuses an employer', async () => {
    const result = await withdrawApplication(user({ role: 'EMPLOYER' }), 'app-1')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN')
  })
})
