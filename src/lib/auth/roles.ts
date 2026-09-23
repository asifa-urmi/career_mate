import type { Role } from '@prisma/client'

/**
 * `shared` is for pages every signed-in role needs and none of them owns —
 * account settings and the notification inbox. Without it those pages would have
 * to be duplicated per role, or filed under one role and then refused to the
 * others by their own sidebar's links.
 */
export type RouteGroup = 'marketing' | 'auth' | 'shared' | 'candidate' | 'employer' | 'admin'

const HOME_BY_ROLE: Record<Role, string> = {
  CANDIDATE: '/dashboard',
  EMPLOYER: '/employer',
  ADMIN: '/admin',
}

export function homePathFor(role: Role): string {
  return HOME_BY_ROLE[role]
}

/**
 * First path segment -> owning route group.
 *
 * Matching on the whole first segment rather than a string prefix is what keeps
 * `/administrative-notes` out of the admin group and `/jobs-public` out of the
 * candidate group. A prefix check would misfile both.
 */
const GROUP_BY_SEGMENT: Record<string, RouteGroup> = {
  // marketing — public
  'jobs-public': 'marketing',

  // auth — signing in, signing up, finishing setup
  login: 'auth',
  signup: 'auth',
  onboarding: 'auth',
  'company-setup': 'auth',

  // shared — any signed-in role
  settings: 'shared',
  notifications: 'shared',

  // candidate
  dashboard: 'candidate',
  jobs: 'candidate',
  apply: 'candidate',
  tracker: 'candidate',
  saved: 'candidate',
  resume: 'candidate',
  'ai-coach': 'candidate',
  messages: 'candidate',
  profile: 'candidate',

  // employer
  employer: 'employer',
  'post-job': 'employer',
  'manage-jobs': 'employer',
  candidates: 'employer',
  pipeline: 'employer',
  analytics: 'employer',
  'company-profile': 'employer',

  // admin
  admin: 'admin',
}

/**
 * Unrecognised paths fall to `marketing`, which means "public": middleware lets
 * them through and Next renders its 404. Defaulting to a protected group would
 * turn every typo into a login redirect.
 */
export function routeGroupFor(pathname: string): RouteGroup {
  const segment = pathname.split('/').filter(Boolean)[0]
  if (!segment) return 'marketing'
  return GROUP_BY_SEGMENT[segment] ?? 'marketing'
}

const ALLOWED_GROUPS: Record<Role, readonly RouteGroup[]> = {
  CANDIDATE: ['marketing', 'auth', 'shared', 'candidate'],
  EMPLOYER: ['marketing', 'auth', 'shared', 'employer'],
  ADMIN: ['marketing', 'auth', 'shared', 'candidate', 'employer', 'admin'],
}

export function canAccess(role: Role, group: RouteGroup): boolean {
  return ALLOWED_GROUPS[role].includes(group)
}
