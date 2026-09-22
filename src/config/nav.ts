import type { Role } from '@prisma/client'

export type NavItem = { href: string; label: string; glyph: string }
export type NavSection = { section: string; items: NavItem[] }

/**
 * Sidebar navigation, ported from the prototype's three nav arrays with its
 * glyphs kept. Grouped into labelled sections rather than one flat list, because
 * ten undifferentiated links is a wall.
 *
 * Every href here must be one the role's own guard admits — a link the sidebar
 * offers and the guard then refuses is a dead end. `tests/unit/categories.test.ts`
 * asserts that against `canAccess`, so adding a link to the wrong role's section
 * fails the suite rather than shipping.
 */
const CANDIDATE_NAV: NavSection[] = [
  {
    section: 'Candidate workspace',
    items: [
      { href: '/dashboard', label: 'Home', glyph: '⌂' },
      { href: '/jobs', label: 'Find jobs', glyph: '⌕' },
      { href: '/saved', label: 'Saved jobs', glyph: '♡' },
    ],
  },
  {
    section: 'Applications',
    items: [
      { href: '/resume', label: 'CV & Resume', glyph: '▤' },
      { href: '/tracker', label: 'Applications', glyph: '◫' },
      { href: '/ai-coach', label: 'AI Career Coach', glyph: '✦' },
    ],
  },
  {
    section: 'Account',
    items: [
      { href: '/messages', label: 'Messages', glyph: '✉' },
      { href: '/notifications', label: 'Notifications', glyph: '◌' },
      { href: '/profile', label: 'Profile', glyph: '◉' },
      { href: '/settings', label: 'Settings', glyph: '⚙' },
    ],
  },
]

const EMPLOYER_NAV: NavSection[] = [
  {
    section: 'Employer workspace',
    items: [
      { href: '/employer', label: 'Overview', glyph: '⌂' },
      { href: '/post-job', label: 'Post a job', glyph: '＋' },
      { href: '/manage-jobs', label: 'Manage jobs', glyph: '▤' },
    ],
  },
  {
    section: 'Hiring',
    items: [
      { href: '/candidates', label: 'Candidates', glyph: '◎' },
      { href: '/pipeline', label: 'Hiring pipeline', glyph: '◫' },
      { href: '/employer/messages', label: 'Messages', glyph: '✉' },
    ],
  },
  {
    section: 'Company',
    items: [
      { href: '/analytics', label: 'Analytics', glyph: '↗' },
      { href: '/company-profile', label: 'Company profile', glyph: '▦' },
      { href: '/notifications', label: 'Notifications', glyph: '◌' },
      { href: '/settings', label: 'Settings', glyph: '⚙' },
    ],
  },
]

const ADMIN_NAV: NavSection[] = [
  {
    section: 'Platform admin',
    items: [
      { href: '/admin', label: 'Overview', glyph: '⌂' },
      { href: '/admin/users', label: 'Users', glyph: '◉' },
      { href: '/admin/jobs', label: 'Job moderation', glyph: '▤' },
      { href: '/admin/reports', label: 'Reports & safety', glyph: '!' },
    ],
  },
  {
    section: 'Account',
    items: [
      { href: '/notifications', label: 'Notifications', glyph: '◌' },
      { href: '/settings', label: 'Settings', glyph: '⚙' },
    ],
  },
]

const NAV_BY_ROLE: Record<Role, NavSection[]> = {
  CANDIDATE: CANDIDATE_NAV,
  EMPLOYER: EMPLOYER_NAV,
  ADMIN: ADMIN_NAV,
}

export function navFor(role: Role): NavSection[] {
  return NAV_BY_ROLE[role]
}

export const WORKSPACE_LABEL: Record<Role, string> = {
  CANDIDATE: 'Candidate workspace',
  EMPLOYER: 'Employer workspace',
  ADMIN: 'Platform admin',
}
