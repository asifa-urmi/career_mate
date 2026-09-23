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

/**
 * What a candidate is shown about a stage change.
 *
 * `note` is deliberately absent. The employer's stage control tells them the
 * note is "recorded in the history, not shown to the candidate", and they write
 * their internal reasoning under that promise — so it must not be selected by
 * any candidate-facing query, not merely hidden by a component that could later
 * be changed.
 */
export type ApplicationEventModel = {
  id: string
  fromStage: ApplicationStage | null
  toStage: ApplicationStage
  at: Date
  atLabel: string
}

/** A question and the answer given for it, frozen at submit time. */
export type ScreeningAnswer = { question: string; answer: string }

export type ApplicationDetailModel = ApplicationRowModel & {
  coverLetter: string | null
  /**
   * Read from the application, never from the job. The job's questions can be
   * edited after someone applies; what they were asked cannot.
   */
  screening: ScreeningAnswer[]
  events: ApplicationEventModel[]
}

/** Json from the database is unknown until proved otherwise. */
export function toScreeningAnswers(value: unknown): ScreeningAnswer[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return []
    const { question, answer } = entry as Record<string, unknown>
    if (typeof question !== 'string') return []
    return [{ question, answer: typeof answer === 'string' ? answer : '' }]
  })
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

export type TrackedApplication = ApplicationRowModel & {
  screening: ScreeningAnswer[]
  events: ApplicationEventModel[]
}

/**
 * The tracker's whole payload in one query.
 *
 * The page previously listed the rows and then re-read each one individually for
 * its history: 61 queries for 60 applications, with every detail payload
 * serialised into the response whether or not the person expanded it. The
 * history comes back with the row instead.
 */
export async function listCandidateApplications(
  candidateProfileId: string,
  take = 100,
): Promise<TrackedApplication[]> {
  const rows = await prisma.application.findMany({
    where: { candidateProfileId },
    orderBy: { updatedAt: 'desc' },
    take,
    select: {
      ...ROW_SELECT,
      screeningAnswers: true,
      events: {
        orderBy: { createdAt: 'desc' },
        // No `note` - see ApplicationEventModel.
        select: { id: true, fromStage: true, toStage: true, createdAt: true },
      },
    },
  })

  const now = new Date()
  return rows.map((row) => ({
    ...toRowModel(row, now),
    screening: toScreeningAnswers(row.screeningAnswers),
    events: row.events.map((e) => ({
      id: e.id,
      fromStage: e.fromStage,
      toStage: e.toStage,
      at: e.createdAt,
      atLabel: relativeTime(e.createdAt, now),
    })),
  }))
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
          company: { select: { name: true, logoInitials: true } },
        },
      },
      events: {
        orderBy: { createdAt: 'desc' },
        // No `note` — see ApplicationEventModel.
        select: { id: true, fromStage: true, toStage: true, createdAt: true },
      },
    },
  })

  if (!row) return null

  const now = new Date()
  return {
    ...toRowModel(row, now),
    coverLetter: row.coverLetter,
    screening: toScreeningAnswers(row.screeningAnswers),
    events: row.events.map((e) => ({
      id: e.id,
      fromStage: e.fromStage,
      toStage: e.toStage,
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
