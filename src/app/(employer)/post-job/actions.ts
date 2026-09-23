'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/guards'
import { jobSchema } from '@/lib/validation/job.schema'
import {
  closeJobPosting,
  createJobPosting,
  publishJobPosting,
  updateJobPosting,
} from '@/server/services/job.service'
import type { JobFormState } from '@/components/employer/job-form'

/** A textarea of one-per-line items. */
function lines(formData: FormData, key: string): string[] {
  return String(formData.get(key) ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

/** A comma-separated field. */
function commas(formData: FormData, key: string): string[] {
  return String(formData.get(key) ?? '')
    .split(',')
    .map((l) => l.trim())
    .filter(Boolean)
}

function parse(formData: FormData) {
  return jobSchema.safeParse({
    title: String(formData.get('title') ?? ''),
    category: String(formData.get('category') ?? ''),
    location: String(formData.get('location') ?? ''),
    workMode: String(formData.get('workMode') ?? ''),
    jobType: String(formData.get('jobType') ?? ''),
    salaryMinBdt: String(formData.get('salaryMinBdt') ?? ''),
    salaryMaxBdt: String(formData.get('salaryMaxBdt') ?? ''),
    salaryNote: String(formData.get('salaryNote') ?? ''),
    summary: String(formData.get('summary') ?? ''),
    responsibilities: lines(formData, 'responsibilities'),
    requirements: lines(formData, 'requirements'),
    requiredSkills: commas(formData, 'requiredSkills'),
    preferredSkills: commas(formData, 'preferredSkills'),
    screeningQuestions: lines(formData, 'screeningQuestions'),
  })
}

function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string[]> = {}
  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form')
    out[key] = [...(out[key] ?? []), issue.message]
  }
  return out
}

export async function createJobAction(
  _prev: JobFormState,
  formData: FormData,
): Promise<JobFormState> {
  const user = await requireUser()

  const parsed = parse(formData)
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues) }

  const result = await createJobPosting(user, parsed.data)
  if (!result.ok) return { formError: result.error.message }

  revalidatePath('/manage-jobs')
  redirect('/manage-jobs')
}

export async function updateJobAction(
  jobId: string,
  _prev: JobFormState,
  formData: FormData,
): Promise<JobFormState> {
  const user = await requireUser()

  const parsed = parse(formData)
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues) }

  const result = await updateJobPosting(user, jobId, parsed.data)
  if (!result.ok) return { formError: result.error.message }

  revalidatePath('/manage-jobs')
  redirect('/manage-jobs')
}

export async function publishJobAction(jobId: string): Promise<{ error?: string }> {
  const user = await requireUser()
  const result = await publishJobPosting(user, jobId)
  if (!result.ok) return { error: result.error.message }

  revalidatePath('/manage-jobs')
  revalidatePath('/jobs')
  return {}
}

export async function closeJobAction(jobId: string): Promise<{ error?: string }> {
  const user = await requireUser()
  const result = await closeJobPosting(user, jobId)
  if (!result.ok) return { error: result.error.message }

  revalidatePath('/manage-jobs')
  revalidatePath('/jobs')
  return {}
}
