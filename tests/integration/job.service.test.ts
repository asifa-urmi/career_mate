import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionUser } from '@/lib/auth/session'

const findEmployer = vi.fn()
const createJob = vi.fn()
const updateJob = vi.fn()
const findJob = vi.fn()

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    employerProfile: { findUnique: findEmployer },
    job: { create: createJob, updateMany: updateJob, findFirst: findJob },
  },
}))

const { createJobPosting, updateJobPosting, publishJobPosting, closeJobPosting } = await import(
  '@/server/services/job.service'
)

function user(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'uid-1',
    email: 'e@f.com',
    name: 'E',
    role: 'EMPLOYER',
    onboardedAt: new Date(),
    onboarded: true,
    ...overrides,
  }
}

const input = {
  title: 'Accounts Officer',
  category: 'FINANCE' as const,
  location: 'Dhaka',
  workMode: 'ONSITE' as const,
  jobType: 'FULL_TIME' as const,
  summary: 'Maintain accounts and support month-end closing for the group.',
  responsibilities: ['Record daily transactions'],
  requirements: ['BBA in Accounting'],
  requiredSkills: ['Excel'],
  preferredSkills: [],
  screeningQuestions: [],
}

beforeEach(() => {
  for (const m of [findEmployer, createJob, updateJob, findJob]) m.mockReset()
  findEmployer.mockResolvedValue({ companyId: 'co-1' })
  createJob.mockResolvedValue({ id: 'job-1' })
  updateJob.mockResolvedValue({ count: 1 })
  findJob.mockResolvedValue({ id: 'job-1', status: 'DRAFT' })
})

describe('createJobPosting', () => {
  it('creates a job for the employer company', async () => {
    const result = await createJobPosting(user(), input)

    expect(result.ok).toBe(true)
    expect(createJob.mock.calls[0]?.[0]?.data).toMatchObject({
      companyId: 'co-1',
      postedById: 'uid-1',
      title: 'Accounts Officer',
    })
  })

  // A client cannot publish or approve its own listing. Both are set here, from
  // fixed values, regardless of what arrived.
  it('always creates as a DRAFT awaiting moderation', async () => {
    await createJobPosting(user(), input)

    const data = createJob.mock.calls[0]?.[0]?.data
    expect(data?.status).toBe('DRAFT')
    expect(data?.moderation).toBe('PENDING')
    expect(data?.publishedAt).toBeFalsy()
  })

  it('refuses a candidate', async () => {
    const result = await createJobPosting(user({ role: 'CANDIDATE' }), input)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN')
    expect(createJob).not.toHaveBeenCalled()
  })

  it('refuses an employer with no company', async () => {
    findEmployer.mockResolvedValue(null)

    const result = await createJobPosting(user(), input)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
    expect(createJob).not.toHaveBeenCalled()
  })
})

describe('updateJobPosting', () => {
  it('scopes the update to the caller company, in the where clause', async () => {
    await updateJobPosting(user(), 'job-1', input)

    expect(updateJob.mock.calls[0]?.[0]?.where).toMatchObject({
      id: 'job-1',
      companyId: 'co-1',
    })
  })

  // Ownership is the company, not the poster: a colleague must be able to edit a
  // role someone else at the same company published.
  it('does not scope by the original poster', async () => {
    await updateJobPosting(user({ id: 'a-colleague' }), 'job-1', input)

    expect(JSON.stringify(updateJob.mock.calls[0]?.[0]?.where)).not.toContain('postedById')
  })

  it('reports another company job as not found rather than forbidden', async () => {
    updateJob.mockResolvedValue({ count: 0 })

    const result = await updateJobPosting(user(), 'someone-elses', input)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
  })

  it('refuses a candidate', async () => {
    const result = await updateJobPosting(user({ role: 'CANDIDATE' }), 'job-1', input)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN')
    expect(updateJob).not.toHaveBeenCalled()
  })

  it('never lets an update change moderation state', async () => {
    await updateJobPosting(user(), 'job-1', input)

    const data = updateJob.mock.calls[0]?.[0]?.data
    expect(data?.moderation).toBeUndefined()
    expect(data?.status).toBeUndefined()
  })
})

describe('publishJobPosting', () => {
  it('moves a draft to PUBLISHED and stamps publishedAt', async () => {
    const result = await publishJobPosting(user(), 'job-1')

    expect(result.ok).toBe(true)
    const data = updateJob.mock.calls[0]?.[0]?.data
    expect(data?.status).toBe('PUBLISHED')
    expect(data?.publishedAt).toBeInstanceOf(Date)
  })

  // Publishing makes a job visible only once moderation has approved it. A
  // PUBLISHED job with PENDING moderation stays off the public board, which
  // listPublishedJobs enforces.
  it('does not approve its own moderation', async () => {
    await publishJobPosting(user(), 'job-1')

    expect(updateJob.mock.calls[0]?.[0]?.data?.moderation).toBeUndefined()
  })

  it('scopes publishing to the caller company', async () => {
    await publishJobPosting(user(), 'job-1')

    expect(updateJob.mock.calls[0]?.[0]?.where).toMatchObject({ id: 'job-1', companyId: 'co-1' })
  })

  it('refuses a candidate', async () => {
    const result = await publishJobPosting(user({ role: 'CANDIDATE' }), 'job-1')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN')
  })
})

describe('closeJobPosting', () => {
  it('closes a job scoped to the caller company', async () => {
    const result = await closeJobPosting(user(), 'job-1')

    expect(result.ok).toBe(true)
    expect(updateJob.mock.calls[0]?.[0]?.data?.status).toBe('CLOSED')
    expect(updateJob.mock.calls[0]?.[0]?.where).toMatchObject({ companyId: 'co-1' })
  })

  it('reports another company job as not found', async () => {
    updateJob.mockResolvedValue({ count: 0 })

    const result = await closeJobPosting(user(), 'someone-elses')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
  })
})
