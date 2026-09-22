import { describe, expect, it } from 'vitest'
import { homePathFor, routeGroupFor, canAccess } from '@/lib/auth/roles'

describe('homePathFor', () => {
  it('sends each role to its own workspace', () => {
    expect(homePathFor('CANDIDATE')).toBe('/dashboard')
    expect(homePathFor('EMPLOYER')).toBe('/employer')
    expect(homePathFor('ADMIN')).toBe('/admin')
  })
})

describe('routeGroupFor', () => {
  it('classifies the routes each role group owns', () => {
    expect(routeGroupFor('/')).toBe('marketing')
    expect(routeGroupFor('/jobs-public')).toBe('marketing')
    expect(routeGroupFor('/login')).toBe('auth')
    expect(routeGroupFor('/onboarding')).toBe('auth')
    expect(routeGroupFor('/dashboard')).toBe('candidate')
    expect(routeGroupFor('/jobs/12')).toBe('candidate')
    expect(routeGroupFor('/employer')).toBe('employer')
    expect(routeGroupFor('/post-job')).toBe('employer')
    expect(routeGroupFor('/admin')).toBe('admin')
    expect(routeGroupFor('/admin/users')).toBe('admin')
  })

  it('does not confuse /admin with a candidate route that merely starts similarly', () => {
    expect(routeGroupFor('/administrative-notes')).not.toBe('admin')
  })

  it('treats a trailing slash the same as no trailing slash', () => {
    expect(routeGroupFor('/dashboard/')).toBe('candidate')
  })
})

describe('canAccess', () => {
  it('refuses a candidate the employer and admin groups', () => {
    expect(canAccess('CANDIDATE', 'employer')).toBe(false)
    expect(canAccess('CANDIDATE', 'admin')).toBe(false)
    expect(canAccess('CANDIDATE', 'candidate')).toBe(true)
  })

  it('refuses an employer the candidate and admin groups', () => {
    expect(canAccess('EMPLOYER', 'candidate')).toBe(false)
    expect(canAccess('EMPLOYER', 'admin')).toBe(false)
    expect(canAccess('EMPLOYER', 'employer')).toBe(true)
  })

  it('lets an admin into every group', () => {
    for (const g of ['marketing', 'auth', 'candidate', 'employer', 'admin'] as const) {
      expect(canAccess('ADMIN', g)).toBe(true)
    }
  })

  it('lets every role into marketing and auth', () => {
    for (const r of ['CANDIDATE', 'EMPLOYER', 'ADMIN'] as const) {
      expect(canAccess(r, 'marketing')).toBe(true)
      expect(canAccess(r, 'auth')).toBe(true)
    }
  })
})
