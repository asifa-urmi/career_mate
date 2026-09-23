import 'server-only'

import { prisma } from '@/lib/db/prisma'
import type { CandidateFacts, JobFacts } from './prompts'
import type { MatchCandidate, MatchJob } from '@/lib/matching/score'
import { formatTaka } from '@/lib/utils/format'
import { categoryLabel } from '@/config/categories'

/**
 * Assembles what a model is allowed to see about a person.
 *
 * Everything here is the candidate's own data, fetched by their profile id. The
 * prompt is built from this and nothing else — no other candidate's text ever
 * enters the context, which is the difference between a career assistant and a
 * leak.
 */
export async function candidateFacts(
  candidateProfileId: string,
): Promise<(CandidateFacts & MatchCandidate) | null> {
  const profile = await prisma.candidateProfile.findUnique({
    where: { id: candidateProfileId },
    select: {
      headline: true,
      location: true,
      bio: true,
      experienceLevel: true,
      primarySector: true,
      user: { select: { name: true } },
      skills: { select: { name: true } },
      preference: {
        select: {
          preferredLocation: true,
          workMode: true,
          jobType: true,
          minSalaryBdt: true,
          targetRole: true,
        },
      },
      experiences: {
        orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
        take: 8,
        select: {
          title: true,
          company: true,
          startDate: true,
          endDate: true,
          isCurrent: true,
          description: true,
        },
      },
      educations: { take: 5, select: { degree: true, institution: true } },
      resumes: {
        where: { isPrimary: true },
        take: 1,
        select: { extractedText: true },
      },
    },
  })

  if (!profile) return null

  const year = (d: Date) => d.getFullYear()

  return {
    name: profile.user.name,
    headline: profile.headline,
    location: profile.location,
    bio: profile.bio,
    experienceLevel: profile.experienceLevel,
    skills: profile.skills.map((s) => s.name),
    experiences: profile.experiences.map((e) => ({
      title: e.title,
      company: e.company,
      years: `${year(e.startDate)}–${e.isCurrent ? 'present' : e.endDate ? year(e.endDate) : 'present'}`,
      description: e.description,
    })),
    educations: profile.educations,
    cvText: profile.resumes[0]?.extractedText ?? null,
    primarySector: profile.primarySector,
    preference: profile.preference,
  }
}

export async function jobFacts(jobId: string): Promise<(JobFacts & MatchJob) | null> {
  const job = await prisma.job.findFirst({
    where: { id: jobId, status: 'PUBLISHED', moderation: 'APPROVED' },
    select: {
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
      company: { select: { name: true } },
    },
  })

  if (!job) return null

  return {
    title: job.title,
    company: job.company.name,
    sectorLabel: categoryLabel(job.category),
    category: job.category,
    location: job.location,
    workMode: job.workMode,
    jobType: job.jobType,
    salary: formatTaka(job.salaryMinBdt, job.salaryMaxBdt, job.salaryNote),
    summary: job.summary,
    responsibilities: job.responsibilities,
    requirements: job.requirements,
    requiredSkills: job.requiredSkills,
    preferredSkills: job.preferredSkills,
    salaryMinBdt: job.salaryMinBdt,
    salaryMaxBdt: job.salaryMaxBdt,
  }
}

/** The target role a CV review is aimed at, if the candidate set one. */
export async function targetRoleFor(candidateProfileId: string): Promise<string | null> {
  const preference = await prisma.jobPreference.findUnique({
    where: { candidateProfileId },
    select: { targetRole: true },
  })
  return preference?.targetRole ?? null
}
