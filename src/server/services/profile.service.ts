import 'server-only'

import { prisma } from '@/lib/db/prisma'
import { appError } from '@/lib/utils/errors'
import { err, ok, type Result } from '@/lib/utils/result'
import type { SessionUser } from '@/lib/auth/session'
import type {
  BasicsInput,
  EducationInput,
  ExperienceInput,
  LinkInput,
  SkillsInput,
} from '@/lib/validation/profile.schema'

/**
 * Every write below is scoped by `candidateProfileId` **in the where clause**.
 *
 * Editing someone else's row therefore matches nothing and reports NOT_FOUND —
 * the row is never fetched before it is authorized, and a distinguishable
 * "exists but not yours" would tell an attacker which ids are real.
 */
async function profileIdFor(userId: string): Promise<string | null> {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: { id: true },
  })
  return profile?.id ?? null
}

async function withProfile<T>(
  user: SessionUser,
  run: (profileId: string) => Promise<Result<T>>,
): Promise<Result<T>> {
  if (user.role !== 'CANDIDATE') {
    return err(appError('FORBIDDEN', 'Only a job seeker account has a candidate profile.'))
  }

  const profileId = await profileIdFor(user.id)
  if (!profileId) {
    return err(appError('NOT_FOUND', 'Finish setting up your profile first.'))
  }

  try {
    return await run(profileId)
  } catch {
    return err(appError('INTERNAL', 'We could not save that change. Please try again.'))
  }
}

export function updateBasics(user: SessionUser, input: BasicsInput): Promise<Result<void>> {
  return withProfile(user, async (profileId) => {
    await prisma.candidateProfile.update({
      where: { id: profileId },
      data: {
        headline: input.headline ?? null,
        location: input.location ?? null,
        bio: input.bio ?? null,
        experienceLevel: input.experienceLevel,
        primarySector: input.primarySector,
      },
    })
    return ok(undefined)
  })
}

export function upsertExperience(
  user: SessionUser,
  input: ExperienceInput,
): Promise<Result<void>> {
  return withProfile(user, async (profileId) => {
    const data = {
      title: input.title,
      company: input.company,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      isCurrent: input.isCurrent,
      description: input.description ?? null,
    }

    if (input.id) {
      const result = await prisma.experience.updateMany({
        where: { id: input.id, candidateProfileId: profileId },
        data,
      })
      if (result.count === 0) return err(appError('NOT_FOUND', 'We could not find that entry.'))
      return ok(undefined)
    }

    await prisma.experience.create({ data: { ...data, candidateProfileId: profileId } })
    return ok(undefined)
  })
}

export function deleteExperience(user: SessionUser, id: string): Promise<Result<void>> {
  return withProfile(user, async (profileId) => {
    const result = await prisma.experience.deleteMany({
      where: { id, candidateProfileId: profileId },
    })
    if (result.count === 0) return err(appError('NOT_FOUND', 'We could not find that entry.'))
    return ok(undefined)
  })
}

export function upsertEducation(
  user: SessionUser,
  input: EducationInput,
): Promise<Result<void>> {
  return withProfile(user, async (profileId) => {
    const data = {
      degree: input.degree,
      institution: input.institution,
      fieldOfStudy: input.fieldOfStudy ?? null,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      grade: input.grade ?? null,
    }

    if (input.id) {
      const result = await prisma.education.updateMany({
        where: { id: input.id, candidateProfileId: profileId },
        data,
      })
      if (result.count === 0) return err(appError('NOT_FOUND', 'We could not find that entry.'))
      return ok(undefined)
    }

    await prisma.education.create({ data: { ...data, candidateProfileId: profileId } })
    return ok(undefined)
  })
}

export function deleteEducation(user: SessionUser, id: string): Promise<Result<void>> {
  return withProfile(user, async (profileId) => {
    const result = await prisma.education.deleteMany({
      where: { id, candidateProfileId: profileId },
    })
    if (result.count === 0) return err(appError('NOT_FOUND', 'We could not find that entry.'))
    return ok(undefined)
  })
}

/**
 * Replaces the whole skill set in one transaction.
 *
 * Diffing would leave the profile briefly inconsistent if the second half
 * failed, and the list is short enough that replacing it costs nothing.
 */
export function setSkills(user: SessionUser, input: SkillsInput): Promise<Result<void>> {
  return withProfile(user, async (profileId) => {
    await prisma.$transaction([
      prisma.skill.deleteMany({ where: { candidateProfileId: profileId } }),
      prisma.skill.createMany({
        data: input.skills.map((name) => ({ candidateProfileId: profileId, name })),
      }),
    ])
    return ok(undefined)
  })
}

export function upsertLink(user: SessionUser, input: LinkInput): Promise<Result<void>> {
  return withProfile(user, async (profileId) => {
    const data = { label: input.label, url: input.url }

    if (input.id) {
      const result = await prisma.link.updateMany({
        where: { id: input.id, candidateProfileId: profileId },
        data,
      })
      if (result.count === 0) return err(appError('NOT_FOUND', 'We could not find that link.'))
      return ok(undefined)
    }

    await prisma.link.create({ data: { ...data, candidateProfileId: profileId } })
    return ok(undefined)
  })
}

export function deleteLink(user: SessionUser, id: string): Promise<Result<void>> {
  return withProfile(user, async (profileId) => {
    const result = await prisma.link.deleteMany({
      where: { id, candidateProfileId: profileId },
    })
    if (result.count === 0) return err(appError('NOT_FOUND', 'We could not find that link.'))
    return ok(undefined)
  })
}
