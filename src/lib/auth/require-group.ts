import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/guards'
import { decideGroupAccess } from '@/lib/auth/route-decision'
import type { SessionUser } from '@/lib/auth/session'

/**
 * The guard every workspace layout calls.
 *
 * Each route group knows its own name statically, so the layout does not need
 * the pathname — which server components are not given anyway. It runs the same
 * policy `decideRoute` runs for middleware, using the user row the layout had to
 * load regardless, so role and onboarding enforcement costs no extra query.
 */
export async function requireGroup(
  group: 'candidate' | 'employer' | 'admin' | 'shared',
): Promise<SessionUser> {
  const user = await requireUser()
  const decision = decideGroupAccess(group, user.role, user.onboarded)
  if (decision.action === 'redirect') redirect(decision.to)
  return user
}
