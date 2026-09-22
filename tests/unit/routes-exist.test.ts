import { readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { navFor } from '@/config/nav'

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

    routes.push(`/${segments.join('/')}`.replace(/\/$/, '') || '/')
  }

  return routes
}

const ROUTES = collectRoutes(APP_DIR)

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
})
