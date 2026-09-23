'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/guards'
import { companySetupSchema, onboardingSchema } from '@/lib/validation/onboarding.schema'
import { completeCompanySetup, completeOnboarding } from '@/server/services/onboarding.service'
import { uploadResume } from '@/server/services/resume.service'
import { attachedResume } from '@/lib/validation/attached-file'

export type SetupFormState = {
  fieldErrors?: Record<string, string[]>
  formError?: string
}

function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string[]> = {}
  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form')
    out[key] = [...(out[key] ?? []), issue.message]
  }
  return out
}

/**
 * The wizard submits once, at the end. Everything it collected is re-validated
 * here against the same schema the browser used — this run is the one that
 * counts, because a crafted POST never touches the browser's copy.
 *
 * Role and ownership are checked inside the service, not here: a server action
 * is addressed by a build-hash id identical for every user of a deployment and
 * does not run the route-group layout that guards its page.
 */
export async function completeOnboardingAction(
  _prev: SetupFormState,
  formData: FormData,
): Promise<SetupFormState> {
  const user = await requireUser()

  const parsed = onboardingSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues) }
  }

  const result = await completeOnboarding(user, parsed.data)
  if (!result.ok) return { formError: result.error.message }

  /**
   * The CV, if one was attached, and only after the profile exists.
   *
   * `uploadResume` needs a CandidateProfile to hang the row off, and this is the
   * request that creates it — so the order is not interchangeable.
   *
   * A failure here does not fail onboarding. The profile is already written and
   * `completeOnboarding` refuses a second run, so returning an error would leave
   * the person on a wizard they can no longer submit. They land on the CV page
   * instead, where the file is either listed or can be added again.
   */
  const resume = attachedResume(formData.get('resume'))
  let resumeFailed = false

  if (resume) {
    const upload = await uploadResume(user, {
      fileName: resume.name,
      mimeType: resume.type,
      bytes: Buffer.from(await resume.arrayBuffer()),
    })
    resumeFailed = !upload.ok
  }

  revalidatePath('/', 'layout')
  redirect(resumeFailed ? '/resume' : '/dashboard')
}

export async function completeCompanySetupAction(
  _prev: SetupFormState,
  formData: FormData,
): Promise<SetupFormState> {
  const user = await requireUser()

  const parsed = companySetupSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues) }
  }

  const result = await completeCompanySetup(user, parsed.data)
  if (!result.ok) return { formError: result.error.message }

  revalidatePath('/', 'layout')
  redirect('/employer')
}
