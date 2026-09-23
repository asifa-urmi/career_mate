import type { ApplicationStage, JobCategory } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { relativeTime } from '@/lib/utils/format'

export type ApplicationRowModel = {
  id: string
  jobId: string
  jobTitle: string
  companyName: string
  logoInitials: string
  category: JobCategory
  location: string
  stage: ApplicationStage
  appliedLabel: string
  lastChangeLabel: string
  resumeLabel: string | null
}

export type ApplicationEventModel = {
  id: string
  fromStage: ApplicationStage | null
  toStage: ApplicationStage
  note: string | null
  at: Date
  atLabel: string
}

export type ApplicationDetailModel = ApplicationRowModel & {
  coverLetter: string | null
  screeningQuestions: string[]
  screeningAnswers: Record<string, string>
  events: ApplicationEventModel[]
}

const ROW_SELECT = {
  id: true,
  stage: true,
  createdAt: true,
  updatedAt: true,
  resume: { select: { label: true } },
  job: {
    select: {
      id: true,
      title: true,
      category: true,
      location: true,
      company: { select: { name: true, logoInitials: true } },
    },
  },
} as const

type Row = {
  id: string
  stage: ApplicationStage
  createdAt: Date
  updatedAt: Date
  resume: { label: string } | null
  job: {
    id: string
    title: string
    category: JobCategory
    location: string
    company: { name: string; logoInitials: string }
  }
}

function toRowModel(a: Row, now: Date): ApplicationRowModel {
  return {
    id: a.id,
    jobId: a.job.id,
    jobTitle: a.job.title,
    companyName: a.job.company.name,
    logoInitials: a.job.company.logoInitials,
    category: a.job.category,
    location: a.job.location,
    stage: a.stage,
    appliedLabel: relativeTime(a.createdAt, now),
    lastChangeLabel: relativeTime(a.updatedAt, now),
    resumeLabel: a.resume?.label ?? null,
  }
}

export async function listCandidateApplications(
  candidateProfileId: string,
): Promise<ApplicationRowModel[]> {
  const rows = await prisma.application.findMany({
    where: { candidateProfileId },
    select: ROW_SELECT,
    orderBy: { updatedAt: 'desc' },
  })

  const now = new Date()
  return rows.map((r) => toRowModel(r, now))
}

/**
 * One application, scoped to its owner **in the where clause**.
 *
 * Fetching by id and then comparing owners would mean the row was read before it
 * was authorized, and a difference in timing or error shape between "not yours"
 * and "does not exist" tells an attacker which ids are real.
 */
export async function findCandidateApplication(
  candidateProfileId: string,
  applicationId: string,
): Promise<ApplicationDetailModel | null> {
  const row = await prisma.application.findFirst({
    where: { id: applicationId, candidateProfileId },
    select: {
      ...ROW_SELECT,
      coverLetter: true,
      screeningAnswers: true,
      job: {
        select: {
          id: true,
          title: true,
          category: true,
          location: true,
          screeningQuestions: true,
          company: { select: { name: true, logoInitials: true } },
        },
      },
      events: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, fromStage: true, toStage: true, note: true, createdAt: true },
      },
    },
  })

  if (!row) return null

  const now = new Date()
  return {
    ...toRowModel(row, now),
    coverLetter: row.coverLetter,
    screeningQuestions: row.job.screeningQuestions,
    screeningAnswers: (row.screeningAnswers ?? {}) as Record<string, string>,
    events: row.events.map((e) => ({
      id: e.id,
      fromStage: e.fromStage,
      toStage: e.toStage,
      note: e.note,
      at: e.createdAt,
      atLabel: relativeTime(e.createdAt, now),
    })),
  }
}

/** Which of these jobs the candidate has already applied to, in one query. */
export async function appliedJobIds(candidateProfileId: string): Promise<Set<string>> {
  const rows = await prisma.application.findMany({
    where: { candidateProfileId },
    select: { jobId: true },
  })
  return new Set(rows.map((r) => r.jobId))
}

export async function findApplicationForJob(candidateProfileId: string, jobId: string) {
  return prisma.application.findFirst({
    where: { candidateProfileId, jobId },
    select: { id: true, stage: true },
  })
}

/** The job as the apply form needs it — title, company and its questions. */
export async function findApplyTarget(jobId: string) {
  return prisma.job.findFirst({
    where: { id: jobId, status: 'PUBLISHED', moderation: 'APPROVED' },
    select: {
      id: true,
      title: true,
      screeningQuestions: true,
      company: { select: { name: true, logoInitials: true } },
    },
  })
}
