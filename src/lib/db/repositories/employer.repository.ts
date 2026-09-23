import type { ApplicationStage, JobCategory, JobStatus, ModerationStatus } from '@prisma/client'
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
      applications: { where: { stage: 'APPLIED' }, select: { id: true } },
    },
  })

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
    newCount: j.applications.length,
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
      resume: { select: { label: true, fileName: true } },
      job: { select: { id: true, title: true, screeningQuestions: true } },
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
