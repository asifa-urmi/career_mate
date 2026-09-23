import { prisma } from '@/lib/db/prisma'
import { relativeTime } from '@/lib/utils/format'

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

export type ResumeDetail = {
  id: string
  label: string
  fileName: string
  sizeLabel: string
  uploadedLabel: string
  isPrimary: boolean
  hasText: boolean
}

/**
 * The CV list as the manage screen shows it.
 *
 * `hasText` rather than the text itself: the page never needs the extracted
 * content, and shipping a 50,000-character CV into the client payload to render
 * a badge would be absurd.
 */
export async function listCandidateResumeDetails(
  candidateProfileId: string,
): Promise<ResumeDetail[]> {
  const rows = await prisma.resume.findMany({
    where: { candidateProfileId },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      label: true,
      fileName: true,
      sizeBytes: true,
      isPrimary: true,
      extractedText: true,
      createdAt: true,
    },
  })

  const now = new Date()
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    fileName: r.fileName,
    sizeLabel: formatBytes(r.sizeBytes),
    uploadedLabel: relativeTime(r.createdAt, now),
    isPrimary: r.isPrimary,
    hasText: Boolean(r.extractedText?.trim()),
  }))
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
