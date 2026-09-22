import type { Role } from '@prisma/client'
import { redirect } from 'next/navigation'
import { getCurrentUser, type SessionUser } from '@/lib/auth/session'
import { homePathFor } from '@/lib/auth/roles'

/**
 * Guards redirect rather than throw. An expired cookie mid-form-submit therefore
 * sends the person to the login page instead of surfacing an unhandled error.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}

export async function requireRole(role: Role): Promise<SessionUser> {
  const user = await requireUser()
  // Admins are deliberately allowed through every role gate.
  if (user.role !== role && user.role !== 'ADMIN') redirect(homePathFor(user.role))
  return user
}

/** Where a signed-in but un-onboarded user of this role has to finish first. */
export function onboardingPathFor(role: Role): string {
  return role === 'EMPLOYER' ? '/company-setup' : '/onboarding'
}

export async function requireOnboarded(): Promise<SessionUser> {
  const user = await requireUser()
  if (!user.onboardedAt) redirect(onboardingPathFor(user.role))
  return user
}
