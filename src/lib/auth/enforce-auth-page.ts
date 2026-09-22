import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { decideAuthPageAccess } from '@/lib/auth/route-decision'
import type { SessionUser } from '@/lib/auth/session'

/**
 * Guard for login, signup and the two onboarding pages.
 *
 * Signed-in users are moved on: an onboarded one to their workspace, an
 * un-onboarded one to whichever setup page is theirs. The decision needs the
 * pathname, which a layout is not given, so each page passes its own.
 */
export async function enforceAuthPage(pathname: string): Promise<SessionUser | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const decision = decideAuthPageAccess(pathname, user.role, user.onboarded)
  if (decision.action === 'redirect') redirect(decision.to)

  return user
}
