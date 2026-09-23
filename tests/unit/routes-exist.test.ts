import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { navFor, searchActionFor } from '@/config/nav'
import { canAccess, routeGroupFor } from '@/lib/auth/roles'

const APP_DIR = join(process.cwd(), 'src', 'app')

/**
 * Every route the app actually serves, derived from the files on disk.
 *
 * Next's `typedRoutes` is off, because it cannot see through an `href` passed as
 * a component prop — which every reusable link component does — and cannot check
 * a route assembled at runtime. This replaces it, and covers more: it checks the
 * configured and computed destinations, not just the literals tsc happens to see.
 */
function collectRoutes(dir: string, routes: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)

    if (statSync(full).isDirectory()) {
      collectRoutes(full, routes)
      continue
    }

    if (entry !== 'page.tsx' && entry !== 'page.ts') continue

    const segments = relative(APP_DIR, dir)
      .split(sep)
      .filter(Boolean)
      // Route groups — "(marketing)" — organise files without appearing in URLs.
      .filter((s) => !(s.startsWith('(') && s.endsWith(')')))
      // Private folders — "_internal" — are excluded from routing entirely.
      .filter((s) => !s.startsWith('_'))

    const route = `/${segments.join('/')}`.replace(/\/$/, '') || '/'
    routes.push(route)
    ROUTE_FILES.set(route, full)
  }

  return routes
}

/** route -> the page file serving it, so a test can read what that page renders. */
const ROUTE_FILES = new Map<string, string>()
const ROUTES = collectRoutes(APP_DIR)

/** The page file serving an href, if one exists. */
function pageFileFor(href: string): string | null {
  const wanted = (href.split('?')[0] ?? '').split('/').filter(Boolean)

  for (const route of ROUTES) {
    const actual = route.split('/').filter(Boolean)
    if (actual.length !== wanted.length) continue
    if (actual.every((segment, i) => segment.startsWith('[') || segment === wanted[i])) {
      return ROUTE_FILES.get(route) ?? null
    }
  }

  return null
}

/** A configured href matches a route, allowing for [id] style segments. */
function routeExists(href: string): boolean {
  const path = href.split('?')[0]?.replace(/\/+$/, '') || '/'
  const wanted = path.split('/').filter(Boolean)

  return ROUTES.some((route) => {
    const actual = route.split('/').filter(Boolean)
    if (actual.length !== wanted.length) return false
    return actual.every((segment, i) => segment.startsWith('[') || segment === wanted[i])
  })
}

describe('configured routes resolve to real pages', () => {
  it('finds the app directory', () => {
    expect(ROUTES.length).toBeGreaterThan(0)
  })

  it('serves every sidebar destination for every role', () => {
    const missing: string[] = []

    for (const role of ['CANDIDATE', 'EMPLOYER', 'ADMIN'] as const) {
      for (const section of navFor(role)) {
        for (const item of section.items) {
          if (!routeExists(item.href)) missing.push(`${role} → ${item.href} (${item.label})`)
        }
      }
    }

    expect(missing, `sidebar links with no page:\n${missing.join('\n')}`).toEqual([])
  })

  it('serves the destinations the guards redirect to', () => {
    for (const href of ['/', '/login', '/signup', '/onboarding', '/company-setup']) {
      expect(routeExists(href), `${href} has no page`).toBe(true)
    }
  })

  it('serves each role home page, since homePathFor sends people there', () => {
    for (const href of ['/dashboard', '/employer', '/admin']) {
      expect(routeExists(href), `${href} has no page`).toBe(true)
    }
  })

  it('serves the public job board linked from the landing page and footer', () => {
    expect(routeExists('/jobs-public')).toBe(true)
  })

  // Every job card wraps its title in a link to the detail route. A board of
  // twelve roles whose titles all 404 is worse than no board.
  it('serves the job detail route both boards link every card to', () => {
    expect(routeExists('/jobs-public/some-job-id'), '/jobs-public/[id] has no page').toBe(true)
    expect(routeExists('/jobs/some-job-id'), '/jobs/[id] has no page').toBe(true)
  })

  // Any route a page links to must exist before that link ships. The P0 review
  // found twelve job cards all pointing at a detail page nobody had built.
  it('serves every route the candidate flow links to', () => {
    for (const href of [
      '/jobs',
      '/jobs/some-id',
      '/saved',
      '/tracker',
      '/profile',
      '/apply/some-id',
      '/apply/some-id/submitted',
    ]) {
      expect(routeExists(href), `${href} has no page`).toBe(true)
    }
  })

  it('serves every route the employer flow links to', () => {
    for (const href of [
      '/employer',
      '/post-job',
      '/manage-jobs',
      '/manage-jobs/some-id',
      '/candidates',
      '/candidates/some-id',
      '/company-profile',
    ]) {
      expect(routeExists(href), href + ' has no page').toBe(true)
    }
  })

  it('serves every P2 and P3 route', () => {
    for (const href of [
      '/resume',
      '/ai-coach',
      '/messages',
      '/employer/messages',
      '/pipeline',
      '/analytics',
      '/admin/users',
      '/admin/jobs',
      '/admin/reports',
      '/settings',
      '/notifications',
    ]) {
      expect(routeExists(href), href + ' has no page').toBe(true)
    }
  })

  // Every page the sidebar offers is built, not a placeholder saying it is
  // coming. A nav full of promises is worse than a shorter nav.
  it('has no ComingSoon placeholders left behind a nav link', () => {
    const placeholders: string[] = []

    for (const role of ['CANDIDATE', 'EMPLOYER', 'ADMIN'] as const) {
      for (const section of navFor(role)) {
        for (const item of section.items) {
          const file = pageFileFor(item.href)
          if (file && readFileSync(file, 'utf8').includes('ComingSoon')) {
            placeholders.push(`${role} → ${item.href}`)
          }
        }
      }
    }

    expect(placeholders, `pages still showing a placeholder: ${placeholders.join(', ')}`).toEqual(
      [],
    )
  })

  /**
   * No page still promises a capability as future work.
   *
   * The ComingSoon check above only walks nav hrefs, so it cannot see a page
   * reached by a link from another page. The employer's applicant screen said
   * "Downloading arrives with CV storage" for a whole phase after CV storage
   * shipped — the service that authorizes the download existed, passed its
   * tests, and had no caller on the employer side at all.
   */
  it('has no page promising a capability that has already shipped', () => {
    const stale: string[] = []
    const promises = [/arrives with/i, /coming soon/i, /not yet built/i, /in a later phase/i]

    for (const [route, file] of ROUTE_FILES) {
      const source = readFileSync(file, 'utf8')
      for (const promise of promises) {
        if (promise.test(source)) stale.push(`${route} (${promise.source})`)
      }
    }

    expect(stale, `pages promising future work: ${stale.join(', ')}`).toEqual([])
  })

  // The app shell renders one search form for every role. Pointing it at a group
  // a role cannot enter discards their query and bounces them home.
  it('points the shell search at a route every signed-in role can reach', () => {
    for (const role of ['CANDIDATE', 'EMPLOYER', 'ADMIN'] as const) {
      const target = searchActionFor(role)
      expect(routeExists(target), `${role} search target ${target} has no page`).toBe(true)
      expect(
        canAccess(role, routeGroupFor(target)),
        `${role} search posts to ${target}, which its own guard refuses`,
      ).toBe(true)
    }
  })
})
