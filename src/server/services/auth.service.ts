import 'server-only'

import type { Role } from '@prisma/client'
import { createServerSupabase } from '@/lib/supabase/server'
import { createUserWithRole, findUserById } from '@/lib/db/repositories/user.repository'
import { isOnboarded } from '@/lib/auth/session'
import { appError, validationError } from '@/lib/utils/errors'
import { err, ok, type Result } from '@/lib/utils/result'
import type { LoginInput, SignupInput } from '@/lib/validation/auth.schema'
import { emailRedirectTo } from '@/lib/auth/email-callback'

export type AuthenticatedUser = {
  userId: string
  role: Role
  onboarded: boolean
  /**
   * True when Supabase accepted the signup but issued no session because the
   * project requires email confirmation — which is the default. The caller must
   * show a "check your inbox" screen; redirecting to onboarding would land on a
   * guard that finds no session and bounces to /login with no explanation.
   */
  needsEmailConfirmation: boolean
}

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
/**
 * `origin` is where the person is signing up from, and it decides where the
 * confirmation link points.
 *
 * Without it Supabase falls back to the project's Site URL, which in a fresh
 * project is `http://localhost:3000` — so a deployed site emails every new user
 * a link to a machine they do not have. It is passed in rather than read here
 * because only the request knows it, and a guess would be worse than the
 * fallback.
 */
export async function signUp(
  input: SignupInput & { origin?: string },
): Promise<Result<AuthenticatedUser>> {
  const supabase = await createServerSupabase()

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { name: input.name, role: input.role },
      ...(input.origin ? { emailRedirectTo: emailRedirectTo(input.origin) } : {}),
    },
  })

  if (error) return err(mapSignUpError(error))
  if (!data.user) {
    return err(appError('INTERNAL', 'We could not create your account. Please try again.'))
  }

  // With email confirmation enabled — Supabase's default — signing up with an
  // address that already has a confirmed account is NOT an error. GoTrue returns
  // an obfuscated user carrying a fresh random id and an empty identities array,
  // so that the form cannot be used to discover which addresses are registered.
  // An absent array is not the same signal and must not produce a false conflict.
  if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return err(appError('CONFLICT', 'That email is already registered. Sign in instead.'))
  }

  const needsEmailConfirmation = !data.session

  const existing = await findUserById(data.user.id)
  if (existing) {
    return ok({
      userId: existing.id,
      role: existing.role,
      onboarded: isOnboarded(existing),
      needsEmailConfirmation,
    })
  }

  try {
    const user = await createUserWithRole({
      id: data.user.id,
      email: input.email,
      name: input.name,
      role: input.role,
    })
    return ok({ userId: user.id, role: user.role, onboarded: false, needsEmailConfirmation })
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

  /**
   * A suspended account is turned away here, with the reason.
   *
   * `getCurrentUser` already returns null for one, so without this the sign-in
   * appeared to succeed and then every page bounced them back to login, which
   * bounced them forward again — a loop with valid credentials, no message, and
   * the notification explaining the suspension on a page they could not reach.
   *
   * The session Supabase just issued is discarded, so nobody carries a valid
   * cookie around an app that will not let them in.
   */
  if (user.suspendedAt) {
    await supabase.auth.signOut()

    return err(
      appError(
        'FORBIDDEN',
        user.suspendedReason
          ? `Your account is suspended. Reason: ${user.suspendedReason}. Contact support if you think this is wrong.`
          : 'Your account is suspended. Contact support if you think this is wrong.',
      ),
    )
  }

  return ok({
    userId: user.id,
    role: user.role,
    onboarded: isOnboarded(user),
    needsEmailConfirmation: false,
  })
}
