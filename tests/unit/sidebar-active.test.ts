import { describe, expect, it } from 'vitest'
import { isNavItemActive } from '@/components/layout/nav-active'
import { navFor } from '@/config/nav'

const candidateHrefs = navFor('CANDIDATE').flatMap((s) => s.items.map((i) => i.href))
const adminHrefs = navFor('ADMIN').flatMap((s) => s.items.map((i) => i.href))

describe('isNavItemActive', () => {
  it('marks an exact match active', () => {
    expect(isNavItemActive('/dashboard', '/dashboard', candidateHrefs)).toBe(true)
  })

  it('marks a parent active on its detail page', () => {
    expect(isNavItemActive('/jobs', '/jobs/12', candidateHrefs)).toBe(true)
  })

  it('does not mark a sibling active', () => {
    expect(isNavItemActive('/jobs', '/saved', candidateHrefs)).toBe(false)
  })

  it('does not treat a shared prefix as a match', () => {
    expect(isNavItemActive('/job', '/jobs', candidateHrefs)).toBe(false)
  })

  it('keeps the root of a group inactive when a deeper sibling owns the route', () => {
    expect(isNavItemActive('/admin', '/admin/users', adminHrefs)).toBe(false)
    expect(isNavItemActive('/admin/users', '/admin/users', adminHrefs)).toBe(true)
  })

  it('marks the group root active on a route no sibling claims', () => {
    expect(isNavItemActive('/admin', '/admin/audit-log', adminHrefs)).toBe(true)
  })

  it('ignores a trailing slash on either side', () => {
    expect(isNavItemActive('/dashboard', '/dashboard/', candidateHrefs)).toBe(true)
    expect(isNavItemActive('/dashboard/', '/dashboard', candidateHrefs)).toBe(true)
  })

  it('marks exactly one candidate nav item active for a detail route', () => {
    const active = candidateHrefs.filter((h) => isNavItemActive(h, '/jobs/12', candidateHrefs))
    expect(active).toEqual(['/jobs'])
  })

  it('marks exactly one admin nav item active for a nested route', () => {
    const active = adminHrefs.filter((h) => isNavItemActive(h, '/admin/reports', adminHrefs))
    expect(active).toEqual(['/admin/reports'])
  })
})
