import { prisma } from '@/lib/db/prisma'
import {
  missingProfileSignals,
  profileCompleteness,
  type ProfileForCompleteness,
} from '@/lib/profile/completeness'

export type CandidateDashboardStats = {
  missingSignals: { label: string; href: string }[]
  applications: number
  inProgress: number
  savedJobs: number
  resumes: number
  unreadNotifications: number
  profileCompleteness: number
  primarySector: string | null
}

/**
 * Real counts for a real account. A new candidate's are all zero, and the
 * dashboard says so rather than showing an invented figure — the prototype's
 * hardcoded "18 matches" on an empty profile was the least honest thing in it.
 */
export async function candidateDashboardStats(userId: string): Promise<CandidateDashboardStats> {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      headline: true,
      location: true,
      bio: true,
      primarySector: true,
      preference: { select: { targetRole: true, minSalaryBdt: true } },
      _count: { select: { experiences: true, educations: true, skills: true, resumes: true } },
    },
  })

  if (!profile) {
    return {
      missingSignals: [],
      applications: 0,
      inProgress: 0,
      savedJobs: 0,
      resumes: 0,
      unreadNotifications: 0,
      profileCompleteness: 0,
      primarySector: null,
    }
  }

  const [applications, inProgress, savedJobs, unreadNotifications] = await Promise.all([
    prisma.application.count({ where: { candidateProfileId: profile.id } }),
    prisma.application.count({
      where: {
        candidateProfileId: profile.id,
        stage: { in: ['SCREENING', 'INTERVIEW', 'ASSESSMENT', 'OFFER'] },
      },
    }),
    prisma.savedJob.count({ where: { candidateProfileId: profile.id } }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ])

  const forCompleteness: ProfileForCompleteness = {
    headline: profile.headline,
    location: profile.location,
    bio: profile.bio,
    preference: profile.preference,
    counts: profile._count,
  }

  return {
    applications,
    inProgress,
    savedJobs,
    resumes: profile._count.resumes,
    unreadNotifications,
    profileCompleteness: profileCompleteness(forCompleteness),
    missingSignals: missingProfileSignals(forCompleteness).map((s) => ({
      label: s.label,
      href: s.href,
    })),
    primarySector: profile.primarySector,
  }
}

export type EmployerDashboardStats = {
  companyName: string
  publishedJobs: number
  draftJobs: number
  totalApplications: number
  interviewing: number
  newThisWeek: number
}

export async function employerDashboardStats(userId: string): Promise<EmployerDashboardStats | null> {
  const employer = await prisma.employerProfile.findUnique({
    where: { userId },
    select: { companyId: true, company: { select: { name: true } } },
  })
  if (!employer) return null

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const ownJobs = { job: { companyId: employer.companyId } }

  const [publishedJobs, draftJobs, totalApplications, interviewing, newThisWeek] =
    await Promise.all([
      prisma.job.count({ where: { companyId: employer.companyId, status: 'PUBLISHED' } }),
      prisma.job.count({ where: { companyId: employer.companyId, status: 'DRAFT' } }),
      prisma.application.count({ where: ownJobs }),
      prisma.application.count({
        where: { ...ownJobs, stage: { in: ['INTERVIEW', 'ASSESSMENT'] } },
      }),
      prisma.application.count({ where: { ...ownJobs, createdAt: { gte: weekAgo } } }),
    ])

  return {
    companyName: employer.company.name,
    publishedJobs,
    draftJobs,
    totalApplications,
    interviewing,
    newThisWeek,
  }
}

export type AdminDashboardStats = {
  candidates: number
  employers: number
  publishedJobs: number
  pendingModeration: number
  openReports: number
  applications: number
}

export async function adminDashboardStats(): Promise<AdminDashboardStats> {
  const [candidates, employers, publishedJobs, pendingModeration, openReports, applications] =
    await Promise.all([
      prisma.user.count({ where: { role: 'CANDIDATE' } }),
      prisma.user.count({ where: { role: 'EMPLOYER' } }),
      prisma.job.count({ where: { status: 'PUBLISHED', moderation: 'APPROVED' } }),
      prisma.job.count({ where: { moderation: 'PENDING' } }),
      prisma.report.count({ where: { status: { in: ['OPEN', 'REVIEWING'] } } }),
      prisma.application.count(),
    ])

  return { candidates, employers, publishedJobs, pendingModeration, openReports, applications }
}
