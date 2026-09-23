import 'server-only'

import { prisma } from '@/lib/db/prisma'
import { scoreMatch, type MatchResult } from './score'

/**
 * Scores one candidate against one job, and against a whole listing.
 *
 * The profile is fetched once and reused across every job in a list, so ranking
 * fifty roles is two queries rather than fifty-one.
 */
async function matchProfile(candidateProfileId: string) {
  return prisma.candidateProfile.findUnique({
    where: { id: candidateProfileId },
    select: {
      primarySector: true,
      experienceLevel: true,
      location: true,
      skills: { select: { name: true } },
      preference: {
        select: {
          preferredLocation: true,
          workMode: true,
          jobType: true,
          minSalaryBdt: true,
        },
      },
    },
  })
}

type ProfileRow = NonNullable<Awaited<ReturnType<typeof matchProfile>>>

function toMatchCandidate(profile: ProfileRow) {
  return {
    primarySector: profile.primarySector,
    experienceLevel: profile.experienceLevel,
    location: profile.location,
    skills: profile.skills.map((s) => s.name),
    preference: profile.preference,
  }
}

const JOB_SELECT = {
  id: true,
  category: true,
  location: true,
  workMode: true,
  jobType: true,
  salaryMinBdt: true,
  salaryMaxBdt: true,
  requiredSkills: true,
  preferredSkills: true,
} as const

export async function matchFor(
  candidateProfileId: string,
  jobId: string,
): Promise<MatchResult | null> {
  const [profile, job] = await Promise.all([
    matchProfile(candidateProfileId),
    prisma.job.findFirst({
      where: { id: jobId, status: 'PUBLISHED', moderation: 'APPROVED' },
      select: JOB_SELECT,
    }),
  ])

  if (!profile || !job) return null

  return scoreMatch(toMatchCandidate(profile), job)
}

/** Scores for a set of jobs in one pass, keyed by job id. */
export async function matchScoresFor(
  candidateProfileId: string,
  jobIds: string[],
): Promise<Map<string, number>> {
  if (jobIds.length === 0) return new Map()

  const [profile, jobs] = await Promise.all([
    matchProfile(candidateProfileId),
    prisma.job.findMany({ where: { id: { in: jobIds } }, select: JOB_SELECT }),
  ])

  if (!profile) return new Map()

  const candidate = toMatchCandidate(profile)
  return new Map(jobs.map((job) => [job.id, scoreMatch(candidate, job).score]))
}
