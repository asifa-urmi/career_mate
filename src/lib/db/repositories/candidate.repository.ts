import type { ExperienceLevel, JobCategory } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

export type CandidateProfileModel = {
  headline: string | null
  location: string | null
  bio: string | null
  experienceLevel: ExperienceLevel
  primarySector: JobCategory
  preference: { targetRole: string | null; minSalaryBdt: number | null } | null
  experiences: {
    id: string
    title: string
    company: string
    startDate: Date
    endDate: Date | null
    isCurrent: boolean
    description: string | null
  }[]
  educations: {
    id: string
    degree: string
    institution: string
    startDate: Date | null
    endDate: Date | null
  }[]
  skills: string[]
  links: { id: string; label: string; url: string }[]
  resumeCount: number
}

/** The whole profile graph the page renders, in one query. */
export async function getCandidateProfile(
  candidateProfileId: string,
): Promise<CandidateProfileModel | null> {
  const profile = await prisma.candidateProfile.findUnique({
    where: { id: candidateProfileId },
    select: {
      headline: true,
      location: true,
      bio: true,
      experienceLevel: true,
      primarySector: true,
      preference: { select: { targetRole: true, minSalaryBdt: true } },
      experiences: {
        orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
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
        orderBy: [{ endDate: 'desc' }],
        select: { id: true, degree: true, institution: true, startDate: true, endDate: true },
      },
      skills: { orderBy: { name: 'asc' }, select: { name: true } },
      links: { orderBy: { order: 'asc' }, select: { id: true, label: true, url: true } },
      _count: { select: { resumes: true } },
    },
  })

  if (!profile) return null

  return {
    headline: profile.headline,
    location: profile.location,
    bio: profile.bio,
    experienceLevel: profile.experienceLevel,
    primarySector: profile.primarySector,
    preference: profile.preference,
    experiences: profile.experiences,
    educations: profile.educations,
    skills: profile.skills.map((s) => s.name),
    links: profile.links,
    resumeCount: profile._count.resumes,
  }
}
