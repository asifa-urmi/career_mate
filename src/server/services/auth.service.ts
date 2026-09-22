import 'server-only'

import type { Role } from '@prisma/client'
import { createServerSupabase } from '@/lib/supabase/server'
import { createUserWithRole, findUserById } from '@/lib/db/repositories/user.repository'
import { appError, validationError } from '@/lib/utils/errors'
import { err, ok, type Result } from '@/lib/utils/result'
import type { LoginInput, SignupInput } from '@/lib/validation/auth.schema'

export type AuthenticatedUser = { userId: string; role: Role; onboarded: boolean }

type SupabaseAuthError = { message: string; code?: string; status?: number }

/**
 * Supabase reports failures as opaque-ish error objects. Mapping them here keeps
 * every caller from string-matching `error.message`, and keeps the messages the
 * person reads under our control rather than Supabase's.
 */
function mapSignUpError(error: SupabaseAuthError) {
  const text = `${error.code ?? ''} ${error.message}`.toLowerCase()

  if (text.includes('already registered') || text.includes('user_already_exists')) {
    return appError('CONFLICT', 'That email is already registered. Sign in instead.')
  }
  if (text.includes('weak_password') || text.includes('password')) {
    return validationError({ password: [error.message] })
  }
  if (text.includes('rate') || error.status === 429) {
    return appError('RATE_LIMITED', 'Too many attempts. Wait a minute and try again.')
  }
  return appError('INTERNAL', 'We could not create your account. Please try again.')
}

/**
 * Creates the Supabase auth user, then the User row that carries the role.
 *
 * These are two systems and cannot share a transaction, so the sequence is
 * ordered to fail safe: the auth user is created first, and a failure to write
 * the profile row is reported as a failure. An auth user with no profile row is
 * exactly the state `getCurrentUser()` treats as unauthenticated, so the account
 * is unusable rather than half-working, and a retry completes it — the existing
 * row is detected and reused rather than duplicated.
 */
export async function signUp(input: SignupInput): Promise<Result<AuthenticatedUser>> {
  const supabase = await createServerSupabase()

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { name: input.name, role: input.role } },
  })

  if (error) return err(mapSignUpError(error))
  if (!data.user) {
    return err(appError('INTERNAL', 'We could not create your account. Please try again.'))
  }

  const existing = await findUserById(data.user.id)
  if (existing) {
    return ok({ userId: existing.id, role: existing.role, onboarded: Boolean(existing.onboardedAt) })
  }

  try {
    const user = await createUserWithRole({
      id: data.user.id,
      email: input.email,
      name: input.name,
      role: input.role,
    })
    return ok({ userId: user.id, role: user.role, onboarded: false })
  } catch {
    return err(
      appError(
        'INTERNAL',
        'Your login was created but your profile was not. Please sign in to finish setting up.',
      ),
    )
  }
}

export async function signIn(input: LoginInput): Promise<Result<AuthenticatedUser>> {
  const supabase = await createServerSupabase()

  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  })

  if (error || !data.user) {
    const text = `${(error as SupabaseAuthError | null)?.code ?? ''} ${error?.message ?? ''}`.toLowerCase()

    if (text.includes('email_not_confirmed')) {
      return err(
        appError('UNAUTHENTICATED', 'Check your inbox and confirm your email address first.'),
      )
    }
    if (text.includes('rate') || (error as SupabaseAuthError | null)?.status === 429) {
      return err(appError('RATE_LIMITED', 'Too many attempts. Wait a minute and try again.'))
    }
    // Deliberately identical whether the email is unknown or the password is
    // wrong: distinguishing them lets anyone test which addresses hold accounts.
    return err(appError('UNAUTHENTICATED', 'That email or password is not correct.'))
  }

  const user = await findUserById(data.user.id)
  if (!user) {
    return err(
      appError('INTERNAL', 'Your account is missing its profile. Please contact support.'),
    )
  }

  return ok({ userId: user.id, role: user.role, onboarded: Boolean(user.onboardedAt) })
}
