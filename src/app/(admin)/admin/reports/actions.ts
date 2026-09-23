'use server'

import { revalidatePath } from 'next/cache'
import type { ReportStatus, ReportTargetType } from '@prisma/client'
import { requireUser } from '@/lib/auth/guards'
import { fileReport, resolveReport } from '@/server/services/report.service'

export async function resolveReportAction(
  reportId: string,
  status: ReportStatus,
  note?: string,
): Promise<{ error?: string }> {
  const admin = await requireUser()
  const result = await resolveReport(admin, reportId, status, note)
  if (!result.ok) return { error: result.error.message }

  revalidatePath('/admin/reports')
  revalidatePath('/admin')
  return {}
}

export async function fileReportAction(
  targetType: ReportTargetType,
  targetId: string,
  reason: string,
  detail?: string,
): Promise<{ error?: string }> {
  const user = await requireUser()
  const result = await fileReport(user, { targetType, targetId, reason, detail })
  if (!result.ok) return { error: result.error.message }

  revalidatePath('/admin/reports')
  return {}
}
