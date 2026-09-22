import { beforeEach, describe, expect, it, vi } from 'vitest'

const getUser = vi.fn()
const findUserById = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: async () => ({ auth: { getUser } }),
}))
vi.mock('@/lib/db/repositories/user.repository', () => ({ findUserById }))

const { getCurrentUser } = await import('@/lib/auth/session')

describe('getCurrentUser', () => {
  beforeEach(() => {
    getUser.mockReset()
    findUserById.mockReset()
  })

  it('returns null when there is no Supabase session', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect(await getCurrentUser()).toBeNull()
    expect(findUserById).not.toHaveBeenCalled()
  })

  // Review Focus 1: signup interrupted between auth creation and the profile row.
  // Every protected page reads user.role, so returning a half-user would crash them all.
  it('returns null when a session exists but the User row does not', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'uid-1' } }, error: null })
    findUserById.mockResolvedValue(null)
    expect(await getCurrentUser()).toBeNull()
  })

  it('returns null when Supabase reports an auth error', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'jwt expired' } })
    expect(await getCurrentUser()).toBeNull()
  })

  it('returns the session user when both exist', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'uid-1' } }, error: null })
    findUserById.mockResolvedValue({
      id: 'uid-1',
      email: 'a@b.com',
      name: 'A',
      role: 'CANDIDATE',
      onboardedAt: null,
    })
    const user = await getCurrentUser()
    expect(user?.role).toBe('CANDIDATE')
    expect(user?.onboardedAt).toBeNull()
  })

  it('carries the onboarded timestamp through so guards can read it', async () => {
    const onboardedAt = new Date('2026-09-01T00:00:00Z')
    getUser.mockResolvedValue({ data: { user: { id: 'uid-2' } }, error: null })
    findUserById.mockResolvedValue({
      id: 'uid-2',
      email: 'e@f.com',
      name: 'E',
      role: 'EMPLOYER',
      onboardedAt,
    })
    expect((await getCurrentUser())?.onboardedAt).toEqual(onboardedAt)
  })
})
