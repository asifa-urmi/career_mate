import type { ApplicationStage, ExperienceLevel, JobType, WorkMode } from '@prisma/client'

export const EXPERIENCE_LEVELS = [
  { value: 'ENTRY', label: 'Entry level / Fresher' },
  { value: 'ONE_TO_THREE', label: '1–3 years' },
  { value: 'THREE_TO_FIVE', label: '3–5 years' },
  { value: 'FIVE_PLUS', label: '5+ years' },
] as const satisfies readonly { value: ExperienceLevel; label: string }[]

export const WORK_MODES = [
  { value: 'ANY', label: 'Any' },
  { value: 'ONSITE', label: 'On-site' },
  { value: 'HYBRID', label: 'Hybrid' },
  { value: 'REMOTE', label: 'Remote' },
] as const satisfies readonly { value: WorkMode; label: string }[]

export const JOB_TYPES = [
  { value: 'FULL_TIME', label: 'Full-time' },
  { value: 'PART_TIME', label: 'Part-time' },
  { value: 'INTERNSHIP', label: 'Internship' },
  { value: 'CONTRACT', label: 'Contract' },
] as const satisfies readonly { value: JobType; label: string }[]

export const APPLICATION_STAGES = [
  { value: 'APPLIED', label: 'Applied' },
  { value: 'SCREENING', label: 'Screening' },
  { value: 'INTERVIEW', label: 'Interview' },
  { value: 'ASSESSMENT', label: 'Assessment' },
  { value: 'OFFER', label: 'Offer' },
  { value: 'REJECTED', label: 'Not selected' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
] as const satisfies readonly { value: ApplicationStage; label: string }[]

/** The four chip colours the prototype's `.status` classes provide. */
export type StageTone = 'applied' | 'interview' | 'offer' | 'reject'

export const STAGE_TONE: Record<ApplicationStage, StageTone> = {
  APPLIED: 'applied',
  SCREENING: 'applied',
  INTERVIEW: 'interview',
  ASSESSMENT: 'interview',
  OFFER: 'offer',
  REJECTED: 'reject',
  WITHDRAWN: 'reject',
}

const STAGE_LABEL = new Map(APPLICATION_STAGES.map((s) => [s.value, s.label]))

export function stageLabel(stage: ApplicationStage): string {
  return STAGE_LABEL.get(stage) ?? stage
}

/** The order an application normally advances through. Excludes the exits. */
export const PIPELINE_STAGES = [
  'APPLIED',
  'SCREENING',
  'INTERVIEW',
  'ASSESSMENT',
  'OFFER',
] as const satisfies readonly ApplicationStage[]

// Upload limits, enforced on the server as well as in the browser.
export const MAX_RESUME_BYTES = 10 * 1024 * 1024
export const ACCEPTED_RESUME_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const
export const ACCEPTED_RESUME_EXTENSIONS = '.pdf,.docx'

export const RESUME_BUCKET = 'resumes'
