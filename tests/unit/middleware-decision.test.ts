import { describe, expect, it } from 'vitest'
import { decideRoute } from '@/lib/auth/route-decision'

const anon = { role: null, onboarded: false }

describe('decideRoute', () => {
  it('lets anyone see marketing pages', () => {
    expect(decideRoute({ pathname: '/', ...anon })).toEqual({ action: 'allow' })
    expect(decideRoute({ pathname: '/jobs-public', ...anon })).toEqual({ action: 'allow' })
  })

  it('lets an anonymous visitor reach login and signup', () => {
    expect(decideRoute({ pathname: '/login', ...anon })).toEqual({ action: 'allow' })
    expect(decideRoute({ pathname: '/signup', ...anon })).toEqual({ action: 'allow' })
  })

  it('sends an anonymous visitor from a protected page to login', () => {
    expect(decideRoute({ pathname: '/dashboard', ...anon })).toEqual({
      action: 'redirect',
      to: '/login',
    })
    expect(decideRoute({ pathname: '/employer', ...anon })).toEqual({
      action: 'redirect',
      to: '/login',
    })
    expect(decideRoute({ pathname: '/admin', ...anon })).toEqual({
      action: 'redirect',
      to: '/login',
    })
  })

  // Review Focus 3
  it('sends a candidate who opens an employer URL to their own home', () => {
    expect(decideRoute({ pathname: '/post-job', role: 'CANDIDATE', onboarded: true })).toEqual({
      action: 'redirect',
      to: '/dashboard',
    })
  })

  it('sends an employer who opens a candidate URL to their own home', () => {
    expect(decideRoute({ pathname: '/dashboard', role: 'EMPLOYER', onboarded: true })).toEqual({
      action: 'redirect',
      to: '/employer',
    })
  })

  it('refuses a non-admin the admin group', () => {
    expect(decideRoute({ pathname: '/admin/users', role: 'EMPLOYER', onboarded: true })).toEqual({
      action: 'redirect',
      to: '/employer',
    })
    expect(decideRoute({ pathname: '/admin', role: 'CANDIDATE', onboarded: true })).toEqual({
      action: 'redirect',
      to: '/dashboard',
    })
  })

  it('lets an admin into any group', () => {
    expect(decideRoute({ pathname: '/dashboard', role: 'ADMIN', onboarded: true })).toEqual({
      action: 'allow',
    })
    expect(decideRoute({ pathname: '/post-job', role: 'ADMIN', onboarded: true })).toEqual({
      action: 'allow',
    })
  })

  it('pushes a signed-in but un-onboarded candidate into onboarding', () => {
    expect(decideRoute({ pathname: '/dashboard', role: 'CANDIDATE', onboarded: false })).toEqual({
      action: 'redirect',
      to: '/onboarding',
    })
  })

  it('pushes a signed-in but un-onboarded employer into company setup', () => {
    expect(decideRoute({ pathname: '/employer', role: 'EMPLOYER', onboarded: false })).toEqual({
      action: 'redirect',
      to: '/company-setup',
    })
  })

  it('lets an un-onboarded user stay on their own onboarding page', () => {
    expect(decideRoute({ pathname: '/onboarding', role: 'CANDIDATE', onboarded: false })).toEqual({
      action: 'allow',
    })
    expect(decideRoute({ pathname: '/company-setup', role: 'EMPLOYER', onboarded: false })).toEqual({
      action: 'allow',
    })
  })

  it('moves an un-onboarded user off the wrong onboarding page without looping', () => {
    expect(decideRoute({ pathname: '/onboarding', role: 'EMPLOYER', onboarded: false })).toEqual({
      action: 'redirect',
      to: '/company-setup',
    })
    expect(decideRoute({ pathname: '/company-setup', role: 'CANDIDATE', onboarded: false })).toEqual(
      { action: 'redirect', to: '/onboarding' },
    )
  })

  it('sends a signed-in user away from login and signup', () => {
    expect(decideRoute({ pathname: '/login', role: 'CANDIDATE', onboarded: true })).toEqual({
      action: 'redirect',
      to: '/dashboard',
    })
    expect(decideRoute({ pathname: '/signup', role: 'ADMIN', onboarded: true })).toEqual({
      action: 'redirect',
      to: '/admin',
    })
  })

  it('does not bounce an onboarded user back into onboarding', () => {
    expect(decideRoute({ pathname: '/onboarding', role: 'CANDIDATE', onboarded: true })).toEqual({
      action: 'redirect',
      to: '/dashboard',
    })
  })

  it('keeps a signed-in user on marketing pages rather than herding them home', () => {
    expect(decideRoute({ pathname: '/', role: 'CANDIDATE', onboarded: true })).toEqual({
      action: 'allow',
    })
  })
})
