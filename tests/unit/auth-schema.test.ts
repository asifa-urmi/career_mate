import { describe, expect, it } from 'vitest'
import { loginSchema, signupSchema } from '@/lib/validation/auth.schema'

const valid = { name: 'Rafat', email: 'a@b.com', password: 'longenough1', role: 'CANDIDATE' }

describe('signupSchema', () => {
  it('accepts a valid candidate signup', () => {
    expect(signupSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts a valid employer signup', () => {
    expect(signupSchema.safeParse({ ...valid, role: 'EMPLOYER' }).success).toBe(true)
  })

  it('refuses a password shorter than 8 characters', () => {
    const r = signupSchema.safeParse({ ...valid, password: 'short' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(['password'])
  })

  it('refuses a malformed email', () => {
    expect(signupSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false)
  })

  // Admin is provisioned by a direct database update. A crafted POST that sets
  // role=ADMIN must not create a platform administrator.
  it('refuses self-assignment of the ADMIN role', () => {
    expect(signupSchema.safeParse({ ...valid, role: 'ADMIN' }).success).toBe(false)
  })

  it('refuses an unknown role', () => {
    expect(signupSchema.safeParse({ ...valid, role: 'SUPERUSER' }).success).toBe(false)
  })

  it('refuses a blank name', () => {
    expect(signupSchema.safeParse({ ...valid, name: ' ' }).success).toBe(false)
    expect(signupSchema.safeParse({ ...valid, name: '   ' }).success).toBe(false)
  })

  it('trims the name it stores', () => {
    const r = signupSchema.safeParse({ ...valid, name: '  Rafat Rahman  ' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.name).toBe('Rafat Rahman')
  })

  it('lower-cases and trims the email so a duplicate cannot slip in by case', () => {
    const r = signupSchema.safeParse({ ...valid, email: '  RaFaT@Example.COM ' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.email).toBe('rafat@example.com')
  })

  it('does not trim the password, because spaces are legitimate characters in one', () => {
    const r = signupSchema.safeParse({ ...valid, password: '  spaced pass  ' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.password).toBe('  spaced pass  ')
  })
})

describe('loginSchema', () => {
  it('accepts an email and any non-empty password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true)
  })

  it('refuses an empty password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false)
  })

  it('normalises the email the same way signup does', () => {
    const r = loginSchema.safeParse({ email: ' A@B.COM ', password: 'x' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.email).toBe('a@b.com')
  })
})
