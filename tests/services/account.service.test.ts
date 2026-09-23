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
const authGetUser = vi.fn()
const adminDeleteUser = vi.fn()
const findResumes = vi.fn()
const deleteResumeFile = vi.fn()

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      findFirst: findUser,
      findUnique: findUniqueUser,
      update: updateUser,
      delete: deleteUser,
      count: countUsers,
    },
    resume: { findMany: findResumes },
  },
}))
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: async () => ({
    auth: {
      updateUser: authUpdate,
      signInWithPassword: authSignIn,
      signOut: authSignOut,
      getUser: authGetUser,
    },
  }),
  createAdminSupabase: () => ({ auth: { admin: { deleteUser: adminDeleteUser } } }),
}))
vi.mock('@/lib/supabase/storage', () => ({ deleteResumeFile }))

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
    authGetUser,
    adminDeleteUser,
    findResumes,
    deleteResumeFile,
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
  authGetUser.mockResolvedValue({ data: { user: { id: 'uid-1', email: 'a@b.com' } }, error: null })
  adminDeleteUser.mockResolvedValue({ error: null })
  findResumes.mockResolvedValue([])
  deleteResumeFile.mockResolvedValue(undefined)
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

  /**
   * Supabase only switches the auth email once the confirmation link is clicked.
   * Writing our row first made the two diverge, and `changePassword`
   * re-authenticates with our row's address — so a user who changed their email
   * and did not confirm it could never change their password again, however
   * correct the one they typed.
   */
  it('does not write the new address until Supabase confirms it', async () => {
    const result = await changeEmail(user(), 'new@example.com')

    expect(result.ok).toBe(true)
    expect(authUpdate).toHaveBeenCalledWith({ email: 'new@example.com' })
    expect(updateUser).not.toHaveBeenCalled()
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

  // Against the address Supabase actually holds, not the one in our row: the two
  // differ for as long as an email change is unconfirmed.
  it('re-authenticates against the address the provider holds', async () => {
    authGetUser.mockResolvedValue({
      data: { user: { id: 'uid-1', email: 'confirmed@example.com' } },
      error: null,
    })

    await changePassword(user({ email: 'pending@example.com' }), 'correct', 'longenough1')

    expect(authSignIn).toHaveBeenCalledWith({
      email: 'confirmed@example.com',
      password: 'correct',
    })
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
    countUsers.mockResolvedValue(0)

    const result = await deleteMyAccount(user({ role: 'ADMIN' }), 'DELETE')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('CONFLICT')
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('allows an administrator to leave while another remains', async () => {
    countUsers.mockResolvedValue(1)

    const result = await deleteMyAccount(user({ role: 'ADMIN' }), 'DELETE')

    expect(result.ok).toBe(true)
  })

  /**
   * A suspended admin cannot sign in, so they are not a way back in.
   *
   * Counting them let two admins lock the platform out of itself: A suspends B,
   * then deletes themselves while the count still reads two. Nobody can reach
   * /admin to lift the suspension, and the only repair is editing the database
   * by hand.
   */
  it('counts only administrators who could actually sign in', async () => {
    await deleteMyAccount(user({ role: 'ADMIN' }), 'DELETE')

    expect(countUsers.mock.calls[0]?.[0]?.where).toMatchObject({
      role: 'ADMIN',
      suspendedAt: null,
    })
  })

  it('does not count itself among the administrators who remain', async () => {
    await deleteMyAccount(user({ role: 'ADMIN' }), 'DELETE')

    expect(countUsers.mock.calls[0]?.[0]?.where).toMatchObject({ id: { not: 'uid-1' } })
  })

  it('deletes only the caller own row', async () => {
    await deleteMyAccount(user(), 'DELETE')

    expect(deleteUser.mock.calls[0]?.[0]?.where).toEqual({ id: 'uid-1' })
  })

  // The panel says this removes their CVs. A row in the database is not the CV;
  // the file in the bucket is, and it holds a name, a phone number and often an
  // address. Deleting the row alone leaves it there for good.
  it('removes the CV files from the bucket, not only their rows', async () => {
    findResumes.mockResolvedValue([
      { storagePath: 'uid-1/cv-a.pdf' },
      { storagePath: 'uid-1/cv-b.pdf' },
    ])

    const result = await deleteMyAccount(user(), 'DELETE')

    expect(result.ok).toBe(true)
    expect(deleteResumeFile).toHaveBeenCalledWith('uid-1/cv-a.pdf')
    expect(deleteResumeFile).toHaveBeenCalledWith('uid-1/cv-b.pdf')
  })

  it('reads the CV paths before the row is gone', async () => {
    findResumes.mockResolvedValue([{ storagePath: 'uid-1/cv.pdf' }])

    await deleteMyAccount(user(), 'DELETE')

    expect(findResumes.mock.invocationCallOrder[0]).toBeLessThan(
      deleteUser.mock.invocationCallOrder[0] ?? Infinity,
    )
  })

  /**
   * Without this the auth identity outlives the account, and the email address
   * is bricked: signing up again is refused as already registered, and signing
   * in is refused for having no profile. Neither path has a way out.
   */
  it('deletes the Supabase auth user, so the email can be used again', async () => {
    const result = await deleteMyAccount(user(), 'DELETE')

    expect(result.ok).toBe(true)
    expect(adminDeleteUser).toHaveBeenCalledWith('uid-1')
  })

  it('reports a failure to delete the auth user rather than claiming success', async () => {
    adminDeleteUser.mockResolvedValue({ error: { message: 'boom' } })

    const result = await deleteMyAccount(user(), 'DELETE')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toMatch(/support/i)
  })

  // An employer whose jobs blocked the delete used to see "please try again"
  // forever. The schema now sets the poster null, so this must simply work.
  it('succeeds for an employer who has posted jobs', async () => {
    const result = await deleteMyAccount(user({ role: 'EMPLOYER' }), 'DELETE')

    expect(result.ok).toBe(true)
    expect(deleteUser).toHaveBeenCalled()
  })
})
