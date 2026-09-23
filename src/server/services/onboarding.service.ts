import 'server-only'

import { prisma } from '@/lib/db/prisma'
import { appError } from '@/lib/utils/errors'
import { err, ok, type Result } from '@/lib/utils/result'
import type { SessionUser } from '@/lib/auth/session'
import { companyInitials } from '@/lib/utils/company'
import type { CompanySetupInput, OnboardingInput } from '@/lib/validation/onboarding.schema'

/**
 * Authorization lives here, not in the action that calls it.
 *
 * A server action is a public HTTP endpoint: it is addressed by a build-hash id
 * that is identical for every user of a deployment, and it does NOT run the
 * route-group layout that guards the page it was declared on. Checking the role
 * in the layout alone therefore protects the page and not the action.
 */

/**
 * Writes the candidate profile, their job preferences and the onboarded stamp.
 *
 * All three happen in one transaction: a profile without preferences, or an
 * onboarded stamp without a profile, would let the guards wave the person into a
 * workspace whose pages then find nothing to render.
 */
export async function completeOnboarding(
  user: SessionUser,
  input: OnboardingInput,
): Promise<Result<void>> {
  if (user.role !== 'CANDIDATE') {
    return err(
      appError('FORBIDDEN', 'Only a job seeker account can complete candidate onboarding.'),
    )
  }
  if (user.onboarded) {
    return err(appError('CONFLICT', 'Your profile is already set up. Edit it from Profile.'))
  }

  try {
    await prisma.$transaction(async (tx) => {
      const profile = await tx.candidateProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
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

      const preference = {
        targetRole: input.targetRole ?? null,
        preferredLocation: input.preferredLocation ?? null,
        minSalaryBdt: input.minSalaryBdt ?? null,
        workMode: input.workMode,
        jobType: input.jobType,
      }

      await tx.jobPreference.upsert({
        where: { candidateProfileId: profile.id },
        create: { candidateProfileId: profile.id, ...preference },
        update: preference,
      })

      await tx.user.update({ where: { id: user.id }, data: { onboardedAt: new Date() } })
    })

    return ok(undefined)
  } catch {
    return err(appError('INTERNAL', 'We could not save your profile. Please try again.'))
  }
}

/**
 * Creates a company, or joins an existing unverified one, then writes the
 * employer profile and the onboarded stamp.
 *
 * Joining by name alone is an unverified claim, so it is deliberately narrow:
 *
 *  - A **verified** company is never auto-joined. Typing a known brand's name
 *    would otherwise hand someone a trusted employer to post jobs under.
 *  - An existing company's details are never overwritten by whoever signs up
 *    next. The second employee joins; they do not get to rewrite the profile.
 *  - Names match case-insensitively, so "nexa labs" cannot fork a second company
 *    away from "Nexa Labs".
 */
export async function completeCompanySetup(
  user: SessionUser,
  input: CompanySetupInput,
): Promise<Result<void>> {
  if (user.role !== 'EMPLOYER') {
    return err(appError('FORBIDDEN', 'Only an employer account can set up a company.'))
  }
  if (user.onboarded) {
    return err(
      appError('CONFLICT', 'Your company is already set up. Edit it from Company profile.'),
    )
  }

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const existing = await tx.company.findFirst({
        where: { name: { equals: input.companyName, mode: 'insensitive' } },
        select: { id: true, verified: true },
      })

      if (existing?.verified) return 'verified-claim' as const

      const companyId =
        existing?.id ??
        (
          await tx.company.create({
            data: {
              name: input.companyName,
              logoInitials: companyInitials(input.companyName),
              sector: input.sector,
              size: input.size ?? null,
              website: input.website ?? null,
              location: input.location ?? null,
              about: input.about ?? null,
              verified: false,
            },
            select: { id: true },
          })
        ).id

      await tx.employerProfile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, companyId, title: input.title ?? null },
        update: { companyId, title: input.title ?? null },
      })

      await tx.user.update({ where: { id: user.id }, data: { onboardedAt: new Date() } })

      return 'ok' as const
    })

    if (outcome === 'verified-claim') {
      return err(
        appError(
          'FORBIDDEN',
          'A verified company already uses that name. Contact support to be added to it, or use a different name.',
        ),
      )
    }

    return ok(undefined)
  } catch {
    return err(appError('INTERNAL', 'We could not save your company. Please try again.'))
  }
}
