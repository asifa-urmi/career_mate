'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/guards'
import { applicationSchema } from '@/lib/validation/application.schema'
import { applyToJob, withdrawApplication } from '@/server/services/application.service'

export type ApplyFormState = {
  fieldErrors?: Record<string, string[]>
  formError?: string
}

/**
 * Screening answers arrive as `screening.<index>` fields. Collecting them by
 * index rather than by question text means an employer editing the questions
 * later cannot silently re-label what someone already answered.
 */
function collectScreeningAnswers(formData: FormData): Record<string, string> {
  const answers: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    const match = /^screening\.(\d+)$/.exec(key)
    if (match?.[1] !== undefined && typeof value === 'string') {
      answers[match[1]] = value
    }
  }
  return answers
}

export async function applyAction(
  _prev: ApplyFormState,
  formData: FormData,
): Promise<ApplyFormState> {
  const user = await requireUser()

  const parsed = applicationSchema.safeParse({
    jobId: String(formData.get('jobId') ?? ''),
    resumeId: String(formData.get('resumeId') ?? ''),
    coverLetter: String(formData.get('coverLetter') ?? ''),
    screeningAnswers: collectScreeningAnswers(formData),
    consented: formData.get('consented') === 'on' ? true : undefined,
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form')
      fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message]
    }
    return { fieldErrors }
  }

  const result = await applyToJob(user, parsed.data)
  if (!result.ok) return { formError: result.error.message }

  revalidatePath('/tracker')
  revalidatePath('/jobs')
  redirect(`/apply/${parsed.data.jobId}/submitted`)
}

export async function withdrawAction(applicationId: string): Promise<{ error?: string }> {
  const user = await requireUser()
  const result = await withdrawApplication(user, applicationId)

  if (!result.ok) return { error: result.error.message }

  revalidatePath('/tracker')
  return {}
}
