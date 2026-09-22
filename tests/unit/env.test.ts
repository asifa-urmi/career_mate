import { describe, expect, it } from 'vitest'
import { serverEnvSchema } from '@/lib/env'

describe('serverEnvSchema', () => {
  it('names the missing variable instead of failing silently', () => {
    const result = serverEnvSchema.safeParse({})
    expect(result.success).toBe(false)
    if (!result.success) {
      const missing = result.error.issues.map((i) => i.path.join('.'))
      expect(missing).toContain('DATABASE_URL')
      expect(missing).toContain('SUPABASE_SERVICE_ROLE_KEY')
    }
  })

  it('rejects a Supabase URL that is not a url', () => {
    const result = serverEnvSchema.safeParse({
      DATABASE_URL: 'postgresql://x',
      DIRECT_URL: 'postgresql://x',
      NEXT_PUBLIC_SUPABASE_URL: 'not-a-url',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'k',
      SUPABASE_SERVICE_ROLE_KEY: 'k',
    })
    expect(result.success).toBe(false)
  })

  it('accepts a complete configuration with no AI keys, because the chain adapts', () => {
    const result = serverEnvSchema.safeParse({
      DATABASE_URL: 'postgresql://x',
      DIRECT_URL: 'postgresql://x',
      NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'k',
      SUPABASE_SERVICE_ROLE_KEY: 'k',
    })
    expect(result.success).toBe(true)
  })
})
