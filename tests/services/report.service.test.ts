import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionUser } from '@/lib/auth/session'
import { REPORT_REASONS } from '@/lib/reports/reasons'

const findReport = vi.fn()
const createReport = vi.fn()
const countRecentReports = vi.fn()
const findJob = vi.fn()
const findTargetUser = vi.fn()
const updateReport = vi.fn()
const findReportTx = vi.fn()
const createNotification = vi.fn()

const tx = {
  report: { findFirst: findReportTx, update: updateReport },
  notification: { create: createNotification },
}

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    report: { findFirst: findReport, create: createReport, count: countRecentReports },
    job: { findUnique: findJob },
    user: { findUnique: findTargetUser },
    $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
  },
}))

const { REPORTS_PER_HOUR, fileReport, resolveReport } = await import(
  '@/server/services/report.service'
)

function user(role: SessionUser['role'] = 'CANDIDATE', id = 'uid-1'): SessionUser {
  return { id, email: 'a@b.com', name: 'A', role, onboardedAt: new Date(), onboarded: true }
}

const report = {
  targetType: 'JOB' as const,
  targetId: 'job-1',
  reason: 'Asks for payment or fees',
}

beforeEach(() => {
  for (const m of [
    findReport,
    createReport,
    updateReport,
    findReportTx,
    createNotification,
    countRecentReports,
    findJob,
    findTargetUser,
  ]) {
    m.mockReset()
  }
  findReport.mockResolvedValue(null)
  countRecentReports.mockResolvedValue(0)
  findJob.mockResolvedValue({ id: 'job-1' })
  findTargetUser.mockResolvedValue({ id: 'uid-target' })
  createReport.mockResolvedValue({ id: 'rep-1' })
  findReportTx.mockResolvedValue({
    id: 'rep-1',
    reporterId: 'uid-reporter',
    status: 'OPEN',
    reason: 'Asks for payment or fees',
  })
  updateReport.mockResolvedValue({ id: 'rep-1' })
  createNotification.mockResolvedValue({ id: 'n-1' })
})

describe('fileReport', () => {
  it('files a report from any signed-in account', async () => {
    const result = await fileReport(user(), report)

    expect(result.ok).toBe(true)
    expect(createReport.mock.calls[0]?.[0]?.data).toMatchObject({
      reporterId: 'uid-1',
      targetType: 'JOB',
      targetId: 'job-1',
    })
  })

  it('accepts a report from an employer too', async () => {
    const result = await fileReport(user('EMPLOYER'), report)
    expect(result.ok).toBe(true)
  })

  it('refuses an empty reason', async () => {
    const result = await fileReport(user(), { ...report, reason: '   ' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION')
    expect(createReport).not.toHaveBeenCalled()
  })

  // The reason is a closed set the form offers as a select. A server action is a
  // public endpoint, so nothing stops a hand-made request carrying its own
  // string — and that string is what a moderator reads at the top of the queue.
  it('refuses a reason that is not one the form offers', async () => {
    const result = await fileReport(user(), {
      ...report,
      reason: 'Call 555-0100 for cheap visas',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION')
    expect(createReport).not.toHaveBeenCalled()
  })

  it('accepts every reason the form offers', async () => {
    for (const reason of REPORT_REASONS) {
      createReport.mockClear()
      const result = await fileReport(user(), { ...report, reason })

      expect(result.ok, `${reason} was refused`).toBe(true)
      expect(createReport.mock.calls[0]?.[0]?.data?.reason).toBe(reason)
    }
  })

  // Almost always a double-click. A duplicate row makes the queue look busier
  // than it is and wastes a moderator's attention.
  it('is a no-op when the same person already has an open report on the same thing', async () => {
    findReport.mockResolvedValue({ id: 'rep-existing' })

    const result = await fileReport(user(), report)

    expect(result.ok).toBe(true)
    expect(createReport).not.toHaveBeenCalled()
  })

  it('only treats open reports as duplicates, so a resolved one can be re-raised', async () => {
    await fileReport(user(), report)

    expect(findReport.mock.calls[0]?.[0]?.where).toMatchObject({
      status: { in: ['OPEN', 'REVIEWING'] },
    })
  })
})

describe('resolveReport', () => {
  it('resolves a report', async () => {
    const result = await resolveReport(user('ADMIN'), 'rep-1', 'RESOLVED', 'Job removed')

    expect(result.ok).toBe(true)
    expect(updateReport.mock.calls[0]?.[0]?.data).toMatchObject({
      status: 'RESOLVED',
      resolvedById: 'uid-1',
      resolutionNote: 'Job removed',
    })
  })

  it('refuses a candidate', async () => {
    const result = await resolveReport(user(), 'rep-1', 'RESOLVED')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN')
    expect(updateReport).not.toHaveBeenCalled()
  })

  it('refuses an employer', async () => {
    const result = await resolveReport(user('EMPLOYER'), 'rep-1', 'DISMISSED')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN')
  })

  it('refuses reopening a report, which is not a resolution', async () => {
    const result = await resolveReport(user('ADMIN'), 'rep-1', 'OPEN')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION')
  })

  it('reports an unknown report as not found', async () => {
    findReportTx.mockResolvedValue(null)

    const result = await resolveReport(user('ADMIN'), 'nope', 'RESOLVED')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
  })

  it('is a no-op when the status has not changed', async () => {
    findReportTx.mockResolvedValue({
      id: 'rep-1',
      reporterId: 'uid-reporter',
      status: 'RESOLVED',
      reason: 'x',
    })

    const result = await resolveReport(user('ADMIN'), 'rep-1', 'RESOLVED')

    expect(result.ok).toBe(true)
    expect(updateReport).not.toHaveBeenCalled()
    expect(createNotification).not.toHaveBeenCalled()
  })

  // A queue that swallows reports silently stops receiving them.
  it('tells the reporter what happened', async () => {
    await resolveReport(user('ADMIN'), 'rep-1', 'RESOLVED', 'We removed the listing')

    expect(createNotification.mock.calls[0]?.[0]?.data).toMatchObject({
      userId: 'uid-reporter',
      type: 'SYSTEM',
    })
    expect(createNotification.mock.calls[0]?.[0]?.data?.body).toContain('We removed the listing')
  })

  it('tells the reporter when it is dismissed, not only when it is upheld', async () => {
    await resolveReport(user('ADMIN'), 'rep-1', 'DISMISSED')

    expect(createNotification).toHaveBeenCalled()
    expect(createNotification.mock.calls[0]?.[0]?.data?.body).toMatch(/did not find/i)
  })

  // Picking something up is not an outcome; notifying then would be noise.
  it('does not notify when a report is merely taken up for review', async () => {
    await resolveReport(user('ADMIN'), 'rep-1', 'REVIEWING')

    expect(updateReport).toHaveBeenCalled()
    expect(createNotification).not.toHaveBeenCalled()
  })
})

/**
 * The queue is a moderator's attention, and it was open to anyone signed in.
 *
 * `targetId` was only checked non-empty, so a loop could file unlimited reports
 * against random ids — each one rendering as "the job this was about no longer
 * exists", indistinguishable from a genuine report about a deleted listing, and
 * burying the real ones.
 */
describe('reports are about something, and are rationed', () => {
  it('refuses a report about a job that does not exist', async () => {
    findJob.mockResolvedValue(null)

    const result = await fileReport(user(), report)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
    expect(createReport).not.toHaveBeenCalled()
  })

  it('refuses a report about an account that does not exist', async () => {
    findTargetUser.mockResolvedValue(null)

    const result = await fileReport(user(), {
      targetType: 'USER',
      targetId: 'nobody',
      reason: 'Harassment or abuse',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
    expect(createReport).not.toHaveBeenCalled()
  })

  it('files a report about a job that does exist', async () => {
    const result = await fileReport(user(), report)

    expect(result.ok).toBe(true)
    expect(createReport).toHaveBeenCalled()
  })

  // Somebody reporting ten things in an hour is thorough. Somebody reporting a
  // hundred is flooding the queue.
  it('refuses once this account has filed its hourly allowance', async () => {
    countRecentReports.mockResolvedValue(REPORTS_PER_HOUR)

    const result = await fileReport(user(), report)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('RATE_LIMITED')
    expect(createReport).not.toHaveBeenCalled()
  })

  it('counts only this reporter, over the last hour', async () => {
    await fileReport(user(), report)

    const where = countRecentReports.mock.calls[0]?.[0]?.where
    expect(where).toMatchObject({ reporterId: 'uid-1' })
    expect(where?.createdAt?.gte).toBeInstanceOf(Date)
  })

  it('still allows a report well inside the allowance', async () => {
    countRecentReports.mockResolvedValue(REPORTS_PER_HOUR - 1)

    const result = await fileReport(user(), report)

    expect(result.ok).toBe(true)
  })
})
