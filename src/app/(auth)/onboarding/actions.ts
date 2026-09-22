'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/guards'
import { companySetupSchema, onboardingSchema } from '@/lib/validation/onboarding.schema'
import { completeCompanySetup, completeOnboarding } from '@/server/services/onboarding.service'

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

  revalidatePath('/', 'layout')
  redirect('/dashboard')
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
