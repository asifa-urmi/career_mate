import type {
  ApplicationStage,
  JobCategory,
  JobStatus,
  ModerationStatus,
  Role,
} from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { formatTaka, relativeTime } from '@/lib/utils/format'

export async function companyIdForUser(userId: string): Promise<string | null> {
  const employer = await prisma.employerProfile.findUnique({
    where: { userId },
    select: { companyId: true },
  })
  return employer?.companyId ?? null
}

export type EmployerJobModel = {
  id: string
  title: string
  category: JobCategory
  location: string
  salaryLabel: string
  status: JobStatus
  moderation: ModerationStatus
  applicantCount: number
  newCount: number
  updatedLabel: string
}

export async function listCompanyJobs(companyId: string): Promise<EmployerJobModel[]> {
  const jobs = await prisma.job.findMany({
    where: { companyId },
    orderBy: [{ updatedAt: 'desc' }],
    select: {
      id: true,
      title: true,
      category: true,
      location: true,
      salaryMinBdt: true,
      salaryMaxBdt: true,
      salaryNote: true,
      status: true,
      moderation: true,
      updatedAt: true,
      _count: { select: { applications: true } },
    },
  })

  // One grouped count for the "new" figure rather than selecting every APPLIED
  // row per job to call .length on it — that loaded 20,000 rows into memory to
  // produce the number 20000, on every render of two different pages.
  const newRows = await prisma.application.groupBy({
    by: ['jobId'],
    where: { job: { companyId }, stage: 'APPLIED' },
    _count: { _all: true },
  })
  const newByJob = new Map(newRows.map((r) => [r.jobId, r._count._all]))

  const now = new Date()
  return jobs.map((j) => ({
    id: j.id,
    title: j.title,
    category: j.category,
    location: j.location,
    salaryLabel: formatTaka(j.salaryMinBdt, j.salaryMaxBdt, j.salaryNote),
    status: j.status,
    moderation: j.moderation,
    applicantCount: j._count.applications,
    newCount: newByJob.get(j.id) ?? 0,
    updatedLabel: relativeTime(j.updatedAt, now),
  }))
}

/** One job for the edit form, scoped to the company in the where clause. */
export async function findCompanyJob(companyId: string, jobId: string) {
  return prisma.job.findFirst({
    where: { id: jobId, companyId },
    select: {
      id: true,
      title: true,
      category: true,
      location: true,
      workMode: true,
      jobType: true,
      salaryMinBdt: true,
      salaryMaxBdt: true,
      salaryNote: true,
      summary: true,
      responsibilities: true,
      requirements: true,
      requiredSkills: true,
      preferredSkills: true,
      screeningQuestions: true,
      status: true,
      moderation: true,
    },
  })
}

export type ApplicantModel = {
  id: string
  candidateName: string
  headline: string | null
  location: string | null
  skills: string[]
  stage: ApplicationStage
  jobId: string
  jobTitle: string
  appliedLabel: string
  hasResume: boolean
}

export async function listCompanyApplications(
  companyId: string,
  filter: { jobId?: string; stage?: ApplicationStage } = {},
): Promise<ApplicantModel[]> {
  const rows = await prisma.application.findMany({
    where: {
      job: { companyId },
      ...(filter.jobId ? { jobId: filter.jobId } : {}),
      ...(filter.stage ? { stage: filter.stage } : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      stage: true,
      createdAt: true,
      resumeId: true,
      job: { select: { id: true, title: true } },
      candidateProfile: {
        select: {
          headline: true,
          location: true,
          user: { select: { name: true } },
          skills: { select: { name: true }, take: 5 },
        },
      },
    },
  })

  const now = new Date()
  return rows.map((a) => ({
    id: a.id,
    candidateName: a.candidateProfile.user.name,
    headline: a.candidateProfile.headline,
    location: a.candidateProfile.location,
    skills: a.candidateProfile.skills.map((s) => s.name),
    stage: a.stage,
    jobId: a.job.id,
    jobTitle: a.job.title,
    appliedLabel: relativeTime(a.createdAt, now),
    hasResume: Boolean(a.resumeId),
  }))
}

/**
 * One applicant in full, for the review screen. Scoped to the company in the
 * where clause — the row is never read before it is authorized.
 */
export async function findCompanyApplication(companyId: string, applicationId: string) {
  return prisma.application.findFirst({
    where: { id: applicationId, job: { companyId } },
    select: {
      id: true,
      stage: true,
      createdAt: true,
      coverLetter: true,
      screeningAnswers: true,
      resume: { select: { id: true, label: true, fileName: true } },
      job: { select: { id: true, title: true } },
      candidateProfile: {
        select: {
          headline: true,
          location: true,
          bio: true,
          experienceLevel: true,
          primarySector: true,
          user: { select: { name: true, email: true } },
          skills: { select: { name: true } },
          experiences: {
            orderBy: { startDate: 'desc' },
            select: {
              id: true,
              title: true,
              company: true,
              startDate: true,
              endDate: true,
              isCurrent: true,
              description: true,
            },
          },
          educations: {
            orderBy: { endDate: 'desc' },
            select: { id: true, degree: true, institution: true, endDate: true },
          },
        },
      },
      events: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, fromStage: true, toStage: true, note: true, createdAt: true },
      },
    },
  })
}

export type ModerationQueueItem = {
  id: string
  title: string
  companyName: string
  category: JobCategory
  location: string
  salaryLabel: string
  summary: string
  /**
   * The rest of the body, because a moderator approves what they can see.
   *
   * Only the summary used to reach this screen, so the parts a candidate
   * actually reads were approved by someone who had never seen them — which is
   * exactly where a listing hides a line telling applicants to email a scan of
   * their national ID.
   */
  responsibilities: string[]
  requirements: string[]
  status: JobStatus
  moderation: ModerationStatus
  postedByName: string
  submittedLabel: string
}

/**
 * The moderation queue — every job, filterable by decision, oldest first so the
 * longest-waiting listing is handled first.
 *
 * Unscoped by design: this is the one read whose caller is an ADMIN, and the
 * page that uses it is behind `requireGroup('admin')`.
 */
export async function listJobsForModeration(
  moderation?: ModerationStatus,
): Promise<ModerationQueueItem[]> {
  const jobs = await prisma.job.findMany({
    where: moderation ? { moderation } : {},
    orderBy: [{ updatedAt: 'asc' }],
    take: 100,
    select: {
      id: true,
      title: true,
      category: true,
      location: true,
      salaryMinBdt: true,
      salaryMaxBdt: true,
      salaryNote: true,
      summary: true,
      responsibilities: true,
      requirements: true,
      status: true,
      moderation: true,
      updatedAt: true,
      company: { select: { name: true } },
      postedBy: { select: { name: true } },
    },
  })

  const now = new Date()
  return jobs.map((j) => ({
    id: j.id,
    title: j.title,
    companyName: j.company.name,
    category: j.category,
    location: j.location,
    salaryLabel: formatTaka(j.salaryMinBdt, j.salaryMaxBdt, j.salaryNote),
    summary: j.summary,
    responsibilities: j.responsibilities,
    requirements: j.requirements,
    status: j.status,
    moderation: j.moderation,
    // The poster's account may have been deleted since. The listing is the
    // company's, so it survives them.
    postedByName: j.postedBy?.name ?? 'a former colleague',
    submittedLabel: relativeTime(j.updatedAt, now),
  }))
}

export async function moderationCounts(): Promise<Record<ModerationStatus, number>> {
  const rows = await prisma.job.groupBy({ by: ['moderation'], _count: { _all: true } })
  const counts: Record<ModerationStatus, number> = {
    PENDING: 0,
    APPROVED: 0,
    FLAGGED: 0,
    REMOVED: 0,
  }
  for (const row of rows) counts[row.moderation] = row._count._all
  return counts
}

export type AdminUserRow = {
  id: string
  name: string
  email: string
  role: Role
  suspended: boolean
  suspendedReason: string | null
  joinedLabel: string
  applications: number
  postedJobs: number
}

/** Every account, newest first, for the admin screen. */
export async function listUsersForAdmin(
  filter: { role?: Role; suspended?: boolean; search?: string } = {},
): Promise<AdminUserRow[]> {
  const users = await prisma.user.findMany({
    where: {
      ...(filter.role ? { role: filter.role } : {}),
      ...(filter.suspended === undefined
        ? {}
        : filter.suspended
          ? { suspendedAt: { not: null } }
          : { suspendedAt: null }),
      ...(filter.search
        ? {
            OR: [
              { name: { contains: filter.search, mode: 'insensitive' } },
              { email: { contains: filter.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      suspendedAt: true,
      suspendedReason: true,
      createdAt: true,
      _count: { select: { postedJobs: true } },
      candidateProfile: { select: { _count: { select: { applications: true } } } },
    },
  })

  const now = new Date()
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    suspended: u.suspendedAt !== null,
    suspendedReason: u.suspendedReason,
    joinedLabel: relativeTime(u.createdAt, now),
    applications: u.candidateProfile?._count.applications ?? 0,
    postedJobs: u._count.postedJobs,
  }))
}

export async function adminCounts(): Promise<{
  candidates: number
  employers: number
  admins: number
  suspended: number
}> {
  const [candidates, employers, admins, suspended] = await Promise.all([
    prisma.user.count({ where: { role: 'CANDIDATE' } }),
    prisma.user.count({ where: { role: 'EMPLOYER' } }),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.user.count({ where: { suspendedAt: { not: null } } }),
  ])
  return { candidates, employers, admins, suspended }
}
