import type { ExperienceLevel, JobCategory, JobType, WorkMode } from '@prisma/client'

/**
 * How well a candidate fits a role, computed in code.
 *
 * Deliberately not asked of a model. A score that changes when a provider's
 * quota runs out is not a score, and "92%" is a claim a person will act on — it
 * has to be reproducible and explainable. The AI's job is to narrate the
 * evidence this produces, never to produce it.
 *
 * Every dimension returns its own sub-score and a sentence of evidence, so the
 * explanation is assembled from facts rather than invented around a number.
 */

export type MatchCandidate = {
  primarySector: JobCategory
  experienceLevel: ExperienceLevel
  location: string | null
  skills: string[]
  preference: {
    preferredLocation: string | null
    workMode: WorkMode
    jobType: JobType
    minSalaryBdt: number | null
  } | null
}

export type MatchJob = {
  category: JobCategory
  location: string
  workMode: WorkMode
  jobType: JobType
  salaryMinBdt: number | null
  salaryMaxBdt: number | null
  requiredSkills: string[]
  preferredSkills: string[]
}

export type MatchDimension = {
  key: 'skills' | 'sector' | 'experience' | 'location' | 'salary'
  label: string
  weight: number
  /**
   * `null` means there is not enough information to judge this dimension — the
   * candidate has not said where they want to work, or the job posts no salary.
   *
   * Silence is not agreement. Scoring an unanswered dimension well was how an
   * entirely empty profile came out as a 41% match: two thirds of that number
   * was the system rewarding someone for telling it nothing. Unknown dimensions
   * are excluded from the average and labelled, so the score only ever reflects
   * what is actually known.
   */
  score: number | null
  evidence: string
}

export type MatchResult = {
  score: number
  dimensions: MatchDimension[]
  /** How much of the weighting the known dimensions cover, 0-1. */
  confidence: number
}

/**
 * Skills dominate because they are the thing an employer actually screens on.
 * Salary is lightest: a mismatch is a conversation, not a disqualification.
 */
export const MATCH_WEIGHTS: { key: MatchDimension['key']; label: string; weight: number }[] = [
  { key: 'skills', label: 'Skills', weight: 0.4 },
  { key: 'sector', label: 'Sector', weight: 0.15 },
  { key: 'experience', label: 'Experience', weight: 0.15 },
  { key: 'location', label: 'Location & work mode', weight: 0.2 },
  { key: 'salary', label: 'Salary', weight: 0.1 },
]

const normalise = (s: string) => s.trim().toLowerCase()

function scoreSkills(candidate: MatchCandidate, job: MatchJob): [number, string] {
  const required = job.requiredSkills.map(normalise).filter(Boolean)
  const preferred = job.preferredSkills.map(normalise).filter(Boolean)

  // A role that lists no skills is satisfied by anyone. Scoring it zero would
  // punish the candidate for the employer's omission.
  if (required.length === 0 && preferred.length === 0) {
    return [100, 'This role does not list specific skills.']
  }

  const have = new Set(candidate.skills.map(normalise).filter(Boolean))
  const matchedRequired = required.filter((s) => have.has(s))
  const matchedPreferred = preferred.filter((s) => have.has(s))

  // Required skills carry the weight; preferred ones top it up.
  const requiredScore = required.length ? matchedRequired.length / required.length : 1
  const preferredScore = preferred.length ? matchedPreferred.length / preferred.length : 1
  const combined = required.length
    ? requiredScore * 0.8 + preferredScore * 0.2
    : preferredScore

  const missing = required.filter((s) => !have.has(s))
  const evidence = required.length
    ? `${matchedRequired.length} of ${required.length} required skills${
        missing.length ? `. Missing: ${missing.slice(0, 3).join(', ')}` : ''
      }`
    : `${matchedPreferred.length} of ${preferred.length} preferred skills`

  return [Math.round(combined * 100), evidence]
}

function scoreSector(candidate: MatchCandidate, job: MatchJob): [number, string] {
  if (candidate.primarySector === job.category) {
    return [100, 'This is the sector you chose to focus on.']
  }
  // Not zero: someone changing sector is a normal case, not a disqualification.
  return [40, 'Outside your chosen sector, which is fine if you are switching.']
}

const LEVEL_ORDER: ExperienceLevel[] = ['ENTRY', 'ONE_TO_THREE', 'THREE_TO_FIVE', 'FIVE_PLUS']

function scoreExperience(candidate: MatchCandidate, job: MatchJob): [number, string] {
  // The schema carries no required level on a job, so this reads the job type:
  // an internship suits entry level, a permanent role suits anyone.
  if (job.jobType === 'INTERNSHIP') {
    const isEarly = LEVEL_ORDER.indexOf(candidate.experienceLevel) <= 1
    return isEarly
      ? [100, 'An internship fits your experience level.']
      : [55, 'An internship is below your experience level.']
  }

  return candidate.experienceLevel === 'ENTRY'
    ? [70, 'A permanent role; employers vary on how much experience they expect.']
    : [100, 'Your experience level suits a permanent role.']
}

function scoreLocation(candidate: MatchCandidate, job: MatchJob): [number, string] {
  if (job.workMode === 'REMOTE') {
    return [100, 'Remote, so your location does not matter.']
  }

  const preferred = normalise(candidate.preference?.preferredLocation ?? candidate.location ?? '')
  const jobLocation = normalise(job.location)

  if (!preferred) {
    return [null, 'You have not said where you want to work.']
  }

  // Substring either way, so "Dhaka" matches "Dhaka · Banani" and vice versa.
  const sameCity = preferred.includes(jobLocation) || jobLocation.includes(preferred)
  if (!sameCity) {
    return [30, `Based in ${job.location}, which is not where you said you want to work.`]
  }

  const wantedMode = candidate.preference?.workMode
  if (!wantedMode || wantedMode === 'ANY' || wantedMode === job.workMode) {
    return [100, `In ${job.location}, matching your preference.`]
  }

  return [75, `In ${job.location}, but ${job.workMode.toLowerCase()} rather than your preference.`]
}

function scoreSalary(candidate: MatchCandidate, job: MatchJob): [number, string] {
  const floor = candidate.preference?.minSalaryBdt
  if (!floor) return [null, 'You have not set a minimum salary.']

  const ceiling = job.salaryMaxBdt ?? job.salaryMinBdt
  if (!ceiling) return [null, 'This role does not post a salary.']

  if (ceiling >= floor) return [100, 'The posted range reaches your minimum.']

  // Proportional rather than a cliff: 5% short is nearly a match, half is not.
  const ratio = Math.max(0, ceiling / floor)
  return [
    Math.round(ratio * 100),
    'The posted range tops out below the minimum you set.',
  ]
}

type DimensionScore = [score: number | null, evidence: string]

const SCORERS: Record<
  MatchDimension['key'],
  (c: MatchCandidate, j: MatchJob) => DimensionScore
> = {
  skills: scoreSkills,
  sector: scoreSector,
  experience: scoreExperience,
  location: scoreLocation,
  salary: scoreSalary,
}

export function scoreMatch(candidate: MatchCandidate, job: MatchJob): MatchResult {
  const dimensions: MatchDimension[] = MATCH_WEIGHTS.map(({ key, label, weight }) => {
    const [raw, evidence] = SCORERS[key](candidate, job)
    const score = raw === null ? null : Math.min(100, Math.max(0, Math.round(raw)))
    return { key, label, weight, score, evidence }
  })

  const known = dimensions.filter(
    (d): d is MatchDimension & { score: number } => d.score !== null,
  )
  const confidence = known.reduce((sum, d) => sum + d.weight, 0)

  // Nothing is known at all — a profile with no skills against a job with no
  // requirements. Zero is the honest answer: there is no evidence of a match,
  // and inventing one from an empty average would be worse.
  if (confidence === 0) return { score: 0, dimensions, confidence: 0 }

  // Re-weighted over what is known, so an unanswered dimension neither helps
  // nor hurts — it simply lowers how much of the picture the score covers.
  const weighted = known.reduce((sum, d) => sum + d.score * d.weight, 0) / confidence

  return {
    score: Math.min(100, Math.max(0, Math.round(weighted))),
    dimensions,
    confidence,
  }
}
