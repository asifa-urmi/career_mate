import 'server-only'

import { prisma } from '@/lib/db/prisma'
import { appError } from '@/lib/utils/errors'
import { err, ok, type Result } from '@/lib/utils/result'
import type { SessionUser } from '@/lib/auth/session'
import type { CompanySetupInput } from '@/lib/validation/onboarding.schema'

/**
 * Edits the caller's own company.
 *
 * `verified` is never in the payload and is never written here: verification is
 * a platform decision, and a company that could tick its own badge makes the
 * badge worthless.
 *
 * The name is editable, but renaming to an existing company's name is refused —
 * the unique constraint would reject it anyway, and the message explains why
 * rather than surfacing a database error.
 */
export async function updateCompanyProfile(
  user: SessionUser,
  input: CompanySetupInput,
): Promise<Result<void>> {
  if (user.role !== 'EMPLOYER') {
    return err(appError('FORBIDDEN', 'Only an employer can edit a company profile.'))
  }

  const employer = await prisma.employerProfile.findUnique({
    where: { userId: user.id },
    select: { companyId: true },
  })
  if (!employer) return err(appError('NOT_FOUND', 'We could not find your company.'))

  try {
    const clash = await prisma.company.findFirst({
      where: {
        name: { equals: input.companyName, mode: 'insensitive' },
        id: { not: employer.companyId },
      },
      select: { id: true },
    })
    if (clash) {
      return err(appError('CONFLICT', 'Another company already uses that name.'))
    }

    await prisma.$transaction([
      prisma.company.update({
        where: { id: employer.companyId },
        data: {
          name: input.companyName,
          sector: input.sector,
          size: input.size ?? null,
          website: input.website ?? null,
          location: input.location ?? null,
          about: input.about ?? null,
        },
      }),
      prisma.employerProfile.update({
        where: { userId: user.id },
        data: { title: input.title ?? null },
      }),
    ])

    return ok(undefined)
  } catch {
    return err(appError('INTERNAL', 'We could not save your company. Please try again.'))
  }
}

export async function getCompanyProfile(userId: string) {
  const employer = await prisma.employerProfile.findUnique({
    where: { userId },
    select: {
      title: true,
      company: {
        select: {
          id: true,
          name: true,
          sector: true,
          size: true,
          website: true,
          location: true,
          about: true,
          verified: true,
          _count: { select: { jobs: true, employers: true } },
        },
      },
    },
  })
  return employer
}
