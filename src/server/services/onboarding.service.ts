import 'server-only'

import { prisma } from '@/lib/db/prisma'
import { appError } from '@/lib/utils/errors'
import { err, ok, type Result } from '@/lib/utils/result'
import type { CompanySetupInput, OnboardingInput } from '@/lib/validation/onboarding.schema'
import { companyInitials } from '@/lib/utils/company'

/**
 * Writes the candidate profile, their job preferences and the onboarded stamp.
 *
 * All three happen in one transaction: a profile without preferences, or an
 * onboarded stamp without a profile, would let the guards wave the person into a
 * workspace whose pages then find nothing to render.
 *
 * Upserts rather than creates, so re-submitting the wizard — a double-click, a
 * back-button retry — updates the existing rows instead of failing on the unique
 * constraint.
 */
export async function completeOnboarding(
  userId: string,
  input: OnboardingInput,
): Promise<Result<void>> {
  try {
    await prisma.$transaction(async (tx) => {
      const profile = await tx.candidateProfile.upsert({
        where: { userId },
        create: {
          userId,
          primarySector: input.primarySector,
          experienceLevel: input.experienceLevel,
          location: input.preferredLocation ?? null,
          headline: input.headline ?? null,
        },
        update: {
          primarySector: input.primarySector,
          experienceLevel: input.experienceLevel,
          location: input.preferredLocation ?? null,
          headline: input.headline ?? null,
        },
        select: { id: true },
      })

      await tx.jobPreference.upsert({
        where: { candidateProfileId: profile.id },
        create: {
          candidateProfileId: profile.id,
          targetRole: input.targetRole ?? null,
          preferredLocation: input.preferredLocation ?? null,
          minSalaryBdt: input.minSalaryBdt ?? null,
          workMode: input.workMode,
          jobType: input.jobType,
        },
        update: {
          targetRole: input.targetRole ?? null,
          preferredLocation: input.preferredLocation ?? null,
          minSalaryBdt: input.minSalaryBdt ?? null,
          workMode: input.workMode,
          jobType: input.jobType,
        },
      })

      await tx.user.update({ where: { id: userId }, data: { onboardedAt: new Date() } })
    })

    return ok(undefined)
  } catch {
    return err(appError('INTERNAL', 'We could not save your profile. Please try again.'))
  }
}

/**
 * Creates or joins a company, then the employer profile and the onboarded stamp.
 *
 * Company names are unique, so a second person from the same company joins the
 * existing row rather than creating a duplicate that would split their job
 * listings across two employers.
 */
export async function completeCompanySetup(
  userId: string,
  userName: string,
  input: CompanySetupInput,
): Promise<Result<void>> {
  try {
    await prisma.$transaction(async (tx) => {
      const company = await tx.company.upsert({
        where: { name: input.companyName },
        create: {
          name: input.companyName,
          logoInitials: companyInitials(input.companyName),
          sector: input.sector,
          size: input.size ?? null,
          website: input.website ?? null,
          location: input.location ?? null,
          about: input.about ?? null,
        },
        // An existing company is not overwritten by whoever signs up next; only
        // blank fields are filled in.
        update: {
          size: input.size ?? undefined,
          website: input.website ?? undefined,
          location: input.location ?? undefined,
          about: input.about ?? undefined,
        },
        select: { id: true },
      })

      await tx.employerProfile.upsert({
        where: { userId },
        create: { userId, companyId: company.id, title: input.title ?? null },
        update: { companyId: company.id, title: input.title ?? null },
      })

      await tx.user.update({
        where: { id: userId },
        data: { onboardedAt: new Date(), name: userName },
      })
    })

    return ok(undefined)
  } catch {
    return err(appError('INTERNAL', 'We could not save your company. Please try again.'))
  }
}
