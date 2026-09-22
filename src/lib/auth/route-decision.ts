import type { Role } from '@prisma/client'
import { canAccess, homePathFor, routeGroupFor, type RouteGroup } from '@/lib/auth/roles'
import { onboardingPathFor } from '@/lib/auth/guards'

export type RouteDecision = { action: 'allow' } | { action: 'redirect'; to: string }

export type RouteDecisionInput = {
  pathname: string
  role: Role | null
  onboarded: boolean
}

/**
 * The whole routing policy, as one pure function.
 *
 * Middleware itself cannot be unit-tested without a request harness, and this is
 * exactly the logic that must not be wrong — a mistake here either leaks a
 * workspace to the wrong role or traps someone in a redirect loop. So the
 * decision lives here and its callers only execute it.
 *
 * Two callers, one policy: `middleware.ts` runs it for anonymous visitors (a
 * session cookie is all it can see cheaply), and each route-group layout runs
 * `decideGroupAccess` with the real role it had to load anyway.
 */
export function decideRoute({ pathname, role, onboarded }: RouteDecisionInput): RouteDecision {
  const group = routeGroupFor(pathname)

  // Public. Signed-in users are welcome here too — herding them to their
  // dashboard would make the landing page unreachable once logged in.
  if (group === 'marketing') return { action: 'allow' }

  if (!role) {
    return group === 'auth' ? { action: 'allow' } : { action: 'redirect', to: '/login' }
  }

  if (group === 'auth') return decideAuthPageAccess(pathname, role, onboarded)

  return decideGroupAccess(group, role, onboarded)
}

/**
 * Access to a workspace group by a known user. Access is checked before
 * onboarding, so a candidate poking at an employer URL is sent to their own home
 * rather than into onboarding.
 */
export function decideGroupAccess(
  group: Exclude<RouteGroup, 'marketing' | 'auth'>,
  role: Role,
  onboarded: boolean,
): RouteDecision {
  if (!canAccess(role, group)) return { action: 'redirect', to: homePathFor(role) }
  if (!onboarded) return { action: 'redirect', to: onboardingPathFor(role) }
  return { action: 'allow' }
}

/**
 * Login, signup and the two onboarding pages. An un-onboarded user may sit on
 * their own onboarding page and nowhere else; sending them from the wrong one to
 * the right one terminates, because the right one is allowed.
 */
export function decideAuthPageAccess(
  pathname: string,
  role: Role,
  onboarded: boolean,
): RouteDecision {
  if (onboarded) return { action: 'redirect', to: homePathFor(role) }

  const onboardingPath = onboardingPathFor(role)
  return normalisePath(pathname) === onboardingPath
    ? { action: 'allow' }
    : { action: 'redirect', to: onboardingPath }
}

function normalisePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}
