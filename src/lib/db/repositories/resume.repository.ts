import { prisma } from '@/lib/db/prisma'

export type ResumeChoice = { id: string; label: string; isPrimary: boolean }

/**
 * The candidate's CVs, primary first.
 *
 * Returns an empty list until CV upload ships, which the apply form handles by
 * saying so rather than blocking the application — a role you cannot apply to
 * because a later phase has not landed is worse than one you apply to without a
 * CV attached.
 */
export async function listCandidateResumes(
  candidateProfileId: string,
): Promise<ResumeChoice[]> {
  return prisma.resume.findMany({
    where: { candidateProfileId },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, label: true, isPrimary: true },
  })
}
