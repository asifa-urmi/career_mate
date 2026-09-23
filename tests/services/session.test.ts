import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authGetUser = vi.fn()
const findUserById = vi.fn()
const updateUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: async () => ({ auth: { getUser: authGetUser } }),
}))
vi.mock('@/lib/db/repositories/user.repository', () => ({ findUserById }))
vi.mock('@/lib/db/prisma', () => ({ prisma: { user: { update: updateUser } } }))

const { getCurrentUser } = await import('@/lib/auth/session')

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'uid-1',
    email: 'old@example.com',
    name: 'Rafat',
    role: 'CANDIDATE',
    onboardedAt: new Date(),
    suspendedAt: null,
    suspendedReason: null,
    candidateProfile: { id: 'cp-1' },
    employerProfile: null,
    ...overrides,
  }
}

beforeEach(() => {
  for (const m of [authGetUser, findUserById, updateUser]) m.mockReset()
  authGetUser.mockResolvedValue({
    data: { user: { id: 'uid-1', email: 'old@example.com' } },
    error: null,
  })
  findUserById.mockResolvedValue(row())
  updateUser.mockResolvedValue({ id: 'uid-1' })
})

describe('getCurrentUser', () => {
  it('resolves a signed-in, onboarded user', async () => {
    const user = await getCurrentUser()

    expect(user?.id).toBe('uid-1')
    expect(user?.onboarded).toBe(true)
  })

  it('is null with no Supabase session', async () => {
    authGetUser.mockResolvedValue({ data: { user: null }, error: null })

    expect(await getCurrentUser()).toBeNull()
  })

  it('is null when the session has no matching row', async () => {
    findUserById.mockResolvedValue(null)

    expect(await getCurrentUser()).toBeNull()
  })

  it('is null for a suspended account', async () => {
    findUserById.mockResolvedValue(row({ suspendedAt: new Date() }))

    expect(await getCurrentUser()).toBeNull()
  })

  /**
   * Supabase switches the auth email only when the confirmation link is clicked,
   * so `changeEmail` deliberately leaves our row alone. This is where the change
   * lands: the auth user is already being read for the session, and the address
   * on it is the one that actually signs in.
   */
  describe('reconciling a confirmed email change', () => {
    beforeEach(() => {
      authGetUser.mockResolvedValue({
        data: { user: { id: 'uid-1', email: 'new@example.com' } },
        error: null,
      })
    })

    it('adopts the confirmed address', async () => {
      const user = await getCurrentUser()

      expect(user?.email).toBe('new@example.com')
    })

    it('writes it back, so the rest of the app agrees', async () => {
      await getCurrentUser()

      expect(updateUser).toHaveBeenCalledWith({
        where: { id: 'uid-1' },
        data: { email: 'new@example.com' },
      })
    })

    // A write on every page load would be a query per request for no reason.
    it('writes nothing when the two already agree', async () => {
      authGetUser.mockResolvedValue({
        data: { user: { id: 'uid-1', email: 'old@example.com' } },
        error: null,
      })

      await getCurrentUser()

      expect(updateUser).not.toHaveBeenCalled()
    })

    // A unique-constraint collision here must not take down every page.
    it('still resolves the user when the write fails', async () => {
      updateUser.mockRejectedValue(new Error('unique constraint'))

      const user = await getCurrentUser()

      expect(user?.id).toBe('uid-1')
    })
  })
})

/**
 * Resolving the session twice in one request should cost one round trip, and
 * `getCurrentUser` is wrapped in React's `cache` to make that so.
 *
 * That memoisation cannot be exercised here: `cache` deduplicates within a
 * request scope, which Next provides for a render or an action and this suite
 * does not — two calls here really do run twice. So this asserts the wrapper is
 * in place and says plainly that the behaviour behind it is verified by reading
 * the code, not by running it.
 */
describe('the session is memoised per request', () => {
  it('wraps the resolver rather than exporting it directly', () => {
    const source = readFileSync(join(process.cwd(), 'src', 'lib', 'auth', 'session.ts'), 'utf8')

    expect(source).toMatch(/export const getCurrentUser = cache\(/)
    expect(source).toMatch(/import \{ cache \} from 'react'/)
  })
})
