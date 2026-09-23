import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionUser } from '@/lib/auth/session'

const findUser = vi.fn()
const findUniqueUser = vi.fn()
const updateUser = vi.fn()
const deleteUser = vi.fn()
const countUsers = vi.fn()
const authUpdate = vi.fn()
const authSignIn = vi.fn()
const authSignOut = vi.fn()

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      findFirst: findUser,
      findUnique: findUniqueUser,
      update: updateUser,
      delete: deleteUser,
      count: countUsers,
    },
  },
}))
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: async () => ({
    auth: {
      updateUser: authUpdate,
      signInWithPassword: authSignIn,
      signOut: authSignOut,
    },
  }),
}))

const {
  changeEmail,
  changePassword,
  deleteMyAccount,
  exportMyData,
  updateNotificationPreferences,
} = await import('@/server/services/account.service')

function user(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'uid-1',
    email: 'a@b.com',
    name: 'A',
    role: 'CANDIDATE',
    onboardedAt: new Date(),
    onboarded: true,
    ...overrides,
  }
}

beforeEach(() => {
  for (const m of [
    findUser,
    findUniqueUser,
    updateUser,
    deleteUser,
    countUsers,
    authUpdate,
    authSignIn,
    authSignOut,
  ]) {
    m.mockReset()
  }
  findUser.mockResolvedValue(null)
  findUniqueUser.mockResolvedValue({ id: 'uid-1', email: 'a@b.com', name: 'A' })
  updateUser.mockResolvedValue({ id: 'uid-1' })
  deleteUser.mockResolvedValue({ id: 'uid-1' })
  countUsers.mockResolvedValue(3)
  authUpdate.mockResolvedValue({ error: null })
  authSignIn.mockResolvedValue({ error: null })
  authSignOut.mockResolvedValue({ error: null })
})

describe('changeEmail', () => {
  it('changes to a free address', async () => {
    const result = await changeEmail(user(), 'new@example.com')

    expect(result.ok).toBe(true)
    expect(authUpdate).toHaveBeenCalledWith({ email: 'new@example.com' })
  })

  it('lower-cases and trims, so the same address cannot fork by capitalisation', async () => {
    await changeEmail(user(), '  New@Example.COM ')
    expect(authUpdate).toHaveBeenCalledWith({ email: 'new@example.com' })
  })

  // Review Focus 5.
  it('reports a taken address as a readable conflict, writing nothing', async () => {
    findUser.mockResolvedValue({ id: 'someone-else' })

    const result = await changeEmail(user(), 'taken@example.com')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('CONFLICT')
      expect(result.error.message).toMatch(/already uses/i)
    }
    expect(authUpdate).not.toHaveBeenCalled()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('excludes the caller from the collision check, so saving unchanged works', async () => {
    await changeEmail(user(), 'new@example.com')

    expect(findUser.mock.calls[0]?.[0]?.where).toMatchObject({ id: { not: 'uid-1' } })
  })

  it('is a no-op when the address has not changed', async () => {
    const result = await changeEmail(user(), 'a@b.com')

    expect(result.ok).toBe(true)
    expect(authUpdate).not.toHaveBeenCalled()
  })

  it('refuses something that is not an email', async () => {
    const result = await changeEmail(user(), 'not-an-email')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION')
  })

  it('translates a provider duplicate into the same readable conflict', async () => {
    authUpdate.mockResolvedValue({ error: { message: 'Email address already registered' } })

    const result = await changeEmail(user(), 'new@example.com')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('CONFLICT')
  })
})

describe('changePassword', () => {
  // Otherwise an unlocked laptop is a password change away from a stolen account.
  it('requires the current password to be correct', async () => {
    authSignIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } })

    const result = await changePassword(user(), 'wrong', 'longenough1')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('UNAUTHENTICATED')
    expect(authUpdate).not.toHaveBeenCalled()
  })

  it('changes the password when the current one checks out', async () => {
    const result = await changePassword(user(), 'correct', 'longenough1')

    expect(result.ok).toBe(true)
    expect(authUpdate).toHaveBeenCalledWith({ password: 'longenough1' })
  })

  it('refuses a new password shorter than eight characters', async () => {
    const result = await changePassword(user(), 'correct', 'short')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION')
    expect(authSignIn).not.toHaveBeenCalled()
  })

  it('refuses a blank current password without calling the provider', async () => {
    const result = await changePassword(user(), '', 'longenough1')

    expect(result.ok).toBe(false)
    expect(authSignIn).not.toHaveBeenCalled()
  })
})

describe('updateNotificationPreferences', () => {
  it('saves the chosen types', async () => {
    await updateNotificationPreferences(user(), ['NEW_MESSAGE', 'SYSTEM'])

    expect(updateUser.mock.calls[0]?.[0]?.data?.notifyOn).toEqual(['NEW_MESSAGE', 'SYSTEM'])
  })

  it('accepts turning everything off', async () => {
    const result = await updateNotificationPreferences(user(), [])

    expect(result.ok).toBe(true)
    expect(updateUser.mock.calls[0]?.[0]?.data?.notifyOn).toEqual([])
  })

  it('discards anything not a real notification type', async () => {
    await updateNotificationPreferences(user(), [
      'NEW_MESSAGE',
      'NOT_A_TYPE' as never,
    ])

    expect(updateUser.mock.calls[0]?.[0]?.data?.notifyOn).toEqual(['NEW_MESSAGE'])
  })

  it('de-duplicates', async () => {
    await updateNotificationPreferences(user(), ['SYSTEM', 'SYSTEM'])

    expect(updateUser.mock.calls[0]?.[0]?.data?.notifyOn).toEqual(['SYSTEM'])
  })

  it('only ever writes to the caller own row', async () => {
    await updateNotificationPreferences(user(), ['SYSTEM'])

    expect(updateUser.mock.calls[0]?.[0]?.where).toEqual({ id: 'uid-1' })
  })
})

describe('exportMyData', () => {
  it('exports the caller own account and nobody else', async () => {
    const result = await exportMyData(user())

    expect(result.ok).toBe(true)
    expect(findUniqueUser.mock.calls[0]?.[0]?.where).toEqual({ id: 'uid-1' })
  })

  it('reports a missing account rather than exporting nothing as success', async () => {
    findUniqueUser.mockResolvedValue(null)

    const result = await exportMyData(user())

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
  })
})

describe('deleteMyAccount', () => {
  it('requires typed confirmation', async () => {
    const result = await deleteMyAccount(user(), 'yes')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION')
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('deletes on confirmation, and signs out', async () => {
    const result = await deleteMyAccount(user(), 'DELETE')

    expect(result.ok).toBe(true)
    expect(deleteUser).toHaveBeenCalledWith({ where: { id: 'uid-1' } })
    expect(authSignOut).toHaveBeenCalled()
  })

  it('accepts the confirmation in any case', async () => {
    const result = await deleteMyAccount(user(), ' delete ')
    expect(result.ok).toBe(true)
  })

  // Otherwise the platform loses its own moderation with no route back.
  it('refuses the last administrator', async () => {
    countUsers.mockResolvedValue(1)

    const result = await deleteMyAccount(user({ role: 'ADMIN' }), 'DELETE')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('CONFLICT')
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('allows an administrator to leave while others remain', async () => {
    countUsers.mockResolvedValue(2)

    const result = await deleteMyAccount(user({ role: 'ADMIN' }), 'DELETE')

    expect(result.ok).toBe(true)
  })

  it('deletes only the caller own row', async () => {
    await deleteMyAccount(user(), 'DELETE')

    expect(deleteUser.mock.calls[0]?.[0]?.where).toEqual({ id: 'uid-1' })
  })
})
