import 'server-only'

import { prisma } from '@/lib/db/prisma'
import { appError } from '@/lib/utils/errors'
import { err, ok, type Result } from '@/lib/utils/result'
import type { SessionUser } from '@/lib/auth/session'
import { createSignedResumeUrl } from '@/lib/supabase/storage'

/**
 * Who may download a CV, and the query that proves it.
 *
 * A CV is the most sensitive thing on the platform — full name, history, often a
 * phone number and address. The bucket is private and nothing serves a file
 * directly; a URL is minted only after this decides, and it expires in minutes.
 *
 * Three rules, each expressed as a `where` clause so the row is never read
 * before it is authorized:
 *
 *  - a candidate may read their own;
 *  - an employer may read a CV **only** where it is attached to an application
 *    to one of their own company's jobs — not merely because the candidate has
 *    applied somewhere, and not because they know the id;
 *  - an admin may read either, which is why stage changes record an actor.
 */
export async function signedResumeUrl(
  user: SessionUser,
  resumeId: string,
): Promise<Result<{ url: string; fileName: string }>> {
  const resume = await findAccessibleResume(user, resumeId)

  // Not found rather than forbidden: a distinguishable refusal would confirm
  // which resume ids exist on other people's accounts.
  if (!resume) return err(appError('NOT_FOUND', 'We could not find that CV.'))

  const signed = await createSignedResumeUrl(resume.storagePath, resume.fileName)
  if (!signed.ok) {
    return err(appError('INTERNAL', 'We could not create a download link. Please try again.'))
  }

  return ok({ url: signed.url, fileName: resume.fileName })
}

async function findAccessibleResume(
  user: SessionUser,
  resumeId: string,
): Promise<{ storagePath: string; fileName: string } | null> {
  const select = { storagePath: true, fileName: true } as const

  if (user.role === 'ADMIN') {
    return prisma.resume.findFirst({ where: { id: resumeId }, select })
  }

  if (user.role === 'CANDIDATE') {
    return prisma.resume.findFirst({
      where: { id: resumeId, candidateProfile: { userId: user.id } },
      select,
    })
  }

  const employer = await prisma.employerProfile.findUnique({
    where: { userId: user.id },
    select: { companyId: true },
  })
  if (!employer) return null

  return prisma.resume.findFirst({
    where: {
      id: resumeId,
      // The link that grants access: this CV was sent to a job this company
      // posted. Without it, any employer could read any CV by id.
      applications: { some: { job: { companyId: employer.companyId } } },
    },
    select,
  })
}
