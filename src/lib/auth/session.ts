import type { Role } from '@prisma/client'
import { createServerSupabase } from '@/lib/supabase/server'
import { findUserById } from '@/lib/db/repositories/user.repository'
import { prisma } from '@/lib/db/prisma'

export type SessionUser = {
  id: string
  email: string
  name: string
  role: Role
  onboardedAt: Date | null
  /** Derived — see `isOnboarded`. Guards and routing use this, never the stamp. */
  onboarded: boolean
}

type UserRow = {
  role: Role
  onboardedAt: Date | null
  candidateProfile: { id: string } | null
  employerProfile: { id: string } | null
}

/**
 * Whether setup is genuinely finished.
 *
 * The `onboardedAt` timestamp alone is not enough, because the role and the
 * profile can disagree. Promoting a candidate to EMPLOYER — which the admin
 * screen exists to do, and which the README's own admin procedure walks through
 * — leaves the stamp set and no EmployerProfile. Trusting the stamp then traps
 * that person: /employer sees no company and points at /company-setup, which
 * sees "onboarded" and points back at /employer, with no way out.
 *
 * Admins have neither profile by design, so for them the stamp is the whole
 * answer.
 */
export function isOnboarded(user: UserRow): boolean {
  if (!user.onboardedAt) return false
  if (user.role === 'ADMIN') return true
  if (user.role === 'EMPLOYER') return Boolean(user.employerProfile)
  return Boolean(user.candidateProfile)
}

/**
 * Resolves the caller, or null.
 *
 * A Supabase session with no matching User row means signup was interrupted
 * between creating the auth user and writing the profile. That is treated as
 * unauthenticated rather than as a user with no role: every protected page reads
 * `role`, so handing back a half-built user would crash all of them.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null

  const user = await findUserById(data.user.id)
  if (!user) return null

  // A suspended account is treated as no account. Anything softer — letting them
  // in and hiding features — leaves a suspended employer still able to reach
  // their candidates through a route somebody forgot to cover.
  if (user.suspendedAt) return null

  /**
   * Where a confirmed email change lands.
   *
   * `changeEmail` asks Supabase and deliberately leaves our row alone, because
   * Supabase only switches the auth email once the confirmation link is clicked
   * — and until then the old address is still the one that signs in. The auth
   * user is already being read here, so this costs nothing on the common path
   * and one write on the single page load after a confirmation.
   *
   * A failure is swallowed: a collision on the unique index must not take down
   * every page for this person.
   */
  const email = data.user.email ?? user.email
  if (email !== user.email) {
    try {
      await prisma.user.update({ where: { id: user.id }, data: { email } })
    } catch {
      // The session still resolves; the row catches up on a later load.
    }
  }

  return {
    id: user.id,
    email,
    name: user.name,
    role: user.role,
    onboardedAt: user.onboardedAt,
    onboarded: isOnboarded(user),
  }
}
