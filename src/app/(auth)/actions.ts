'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { homePathFor } from '@/lib/auth/roles'
import { onboardingPathFor } from '@/lib/auth/guards'
import { loginSchema, signupSchema } from '@/lib/validation/auth.schema'
import { signIn, signUp } from '@/server/services/auth.service'
import { createServerSupabase } from '@/lib/supabase/server'

/**
 * What a submitted auth form gets back.
 *
 * `values` echoes what was typed so a rejected submit does not wipe the form —
 * retyping a name and email because the password was four characters short is
 * the kind of small cruelty that makes people give up on a signup.
 */
export type AuthFormState = {
  fieldErrors?: Record<string, string[]>
  formError?: string
  values?: { name?: string; email?: string; role?: string }
  /**
   * Set when the account was created but Supabase issued no session because the
   * project requires email confirmation. The form swaps to a "check your inbox"
   * panel; redirecting instead would land on a guard that finds no session.
   */
  confirmationSentTo?: string
}

function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string[]> = {}
  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form')
    out[key] = [...(out[key] ?? []), issue.message]
  }
  return out
}

export async function signupAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const raw = {
    name: String(formData.get('name') ?? ''),
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
    role: String(formData.get('role') ?? 'CANDIDATE'),
  }
  const echo = { name: raw.name, email: raw.email, role: raw.role }

  const parsed = signupSchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues), values: echo }
  }

  const result = await signUp(parsed.data)
  if (!result.ok) {
    return {
      fieldErrors: result.error.fieldErrors,
      formError: result.error.fieldErrors ? undefined : result.error.message,
      values: echo,
    }
  }

  if (result.value.needsEmailConfirmation) {
    return { confirmationSentTo: parsed.data.email }
  }

  revalidatePath('/', 'layout')
  redirect(onboardingPathFor(result.value.role))
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const raw = {
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  }
  const echo = { email: raw.email }

  const parsed = loginSchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues), values: echo }
  }

  const result = await signIn(parsed.data)
  if (!result.ok) {
    return { formError: result.error.message, values: echo }
  }

  revalidatePath('/', 'layout')
  redirect(
    result.value.onboarded
      ? homePathFor(result.value.role)
      : onboardingPathFor(result.value.role),
  )
}

/**
 * Signs out and clears the cached render tree. Without the revalidate, a
 * signed-out user navigating back is served the previous user's cached page —
 * the session is gone but the rendered HTML is not.
 */
export async function signOutAction(): Promise<void> {
  const supabase = await createServerSupabase()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}
