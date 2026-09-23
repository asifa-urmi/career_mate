import { prisma } from '@/lib/db/prisma'
import type { JobCardModel } from './job.repository'
import { formatTaka, relativeTime } from '@/lib/utils/format'

/**
 * A saved job whose role has since closed still shows, marked, rather than
 * disappearing. Silently dropping it would leave someone wondering whether they
 * ever saved it.
 */
export type SavedJobModel = JobCardModel & { savedAt: Date; stillOpen: boolean }

export async function listSavedJobs(candidateProfileId: string): Promise<SavedJobModel[]> {
  const rows = await prisma.savedJob.findMany({
    where: { candidateProfileId },
    orderBy: { createdAt: 'desc' },
    select: {
      createdAt: true,
      job: {
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
          requiredSkills: true,
          publishedAt: true,
          createdAt: true,
          status: true,
          moderation: true,
          company: { select: { name: true, logoInitials: true } },
          _count: { select: { applications: true } },
        },
      },
    },
  })

  const now = new Date()
  return rows.map(({ createdAt, job }) => ({
    id: job.id,
    title: job.title,
    companyName: job.company.name,
    logoInitials: job.company.logoInitials,
    category: job.category,
    location: job.location,
    workMode: job.workMode,
    jobType: job.jobType,
    salaryLabel: formatTaka(job.salaryMinBdt, job.salaryMaxBdt, job.salaryNote),
    skills: job.requiredSkills.slice(0, 3),
    postedLabel: relativeTime(job.publishedAt ?? job.createdAt, now),
    applicantCount: job._count.applications,
    savedAt: createdAt,
    stillOpen: job.status === 'PUBLISHED' && job.moderation === 'APPROVED',
  }))
}

/**
 * The saved ids for a whole listing in one query, so a board of fifty cards does
 * not issue fifty "is this saved?" round trips.
 */
export async function savedJobIds(candidateProfileId: string): Promise<Set<string>> {
  const rows = await prisma.savedJob.findMany({
    where: { candidateProfileId },
    select: { jobId: true },
  })
  return new Set(rows.map((r) => r.jobId))
}

export async function candidateProfileIdFor(userId: string): Promise<string | null> {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: { id: true },
  })
  return profile?.id ?? null
}
