import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionUser } from '@/lib/auth/session'

const findUser = vi.fn()
const updateUser = vi.fn()
const countAdmins = vi.fn()
const createNotification = vi.fn()

const tx = {
  user: { findFirst: findUser, update: updateUser, count: countAdmins },
  notification: { create: createNotification },
}

vi.mock('@/lib/db/prisma', () => ({
  prisma: { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) },
}))

const { changeUserRole, setUserSuspended } = await import('@/server/services/admin.service')

function admin(id = 'uid-admin'): SessionUser {
  return { id, email: 'ad@min.com', name: 'Ad', role: 'ADMIN', onboardedAt: new Date(), onboarded: true }
}

beforeEach(() => {
  for (const m of [findUser, updateUser, countAdmins, createNotification]) m.mockReset()
  findUser.mockResolvedValue({ id: 'uid-other', name: 'Rafat', role: 'CANDIDATE', suspendedAt: null })
  updateUser.mockResolvedValue({ id: 'uid-other' })
  countAdmins.mockResolvedValue(3)
  createNotification.mockResolvedValue({ id: 'n-1' })
})

describe('changeUserRole', () => {
  it('promotes a candidate to employer', async () => {
    const result = await changeUserRole(admin(), 'uid-other', 'EMPLOYER')

    expect(result.ok).toBe(true)
    expect(updateUser.mock.calls[0]?.[0]?.data?.role).toBe('EMPLOYER')
  })

  it('refuses a non-admin', async () => {
    const notAdmin = { ...admin(), role: 'EMPLOYER' as const }

    const result = await changeUserRole(notAdmin, 'uid-other', 'ADMIN')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN')
    expect(findUser).not.toHaveBeenCalled()
  })

  // Review Focus 3. An admin who demotes themselves cannot undo it, and if they
  // were the last one the platform loses its own moderation entirely.
  it('refuses an admin demoting themselves', async () => {
    const result = await changeUserRole(admin(), 'uid-admin', 'CANDIDATE')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('CONFLICT')
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('refuses demoting the last remaining admin', async () => {
    findUser.mockResolvedValue({ id: 'uid-other', name: 'Other', role: 'ADMIN', suspendedAt: null })
    countAdmins.mockResolvedValue(1)

    const result = await changeUserRole(admin(), 'uid-other', 'CANDIDATE')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('CONFLICT')
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('allows demoting an admin while others remain', async () => {
    findUser.mockResolvedValue({ id: 'uid-other', name: 'Other', role: 'ADMIN', suspendedAt: null })
    countAdmins.mockResolvedValue(2)

    const result = await changeUserRole(admin(), 'uid-other', 'CANDIDATE')

    expect(result.ok).toBe(true)
  })

  it('reports an unknown user as not found', async () => {
    findUser.mockResolvedValue(null)

    const result = await changeUserRole(admin(), 'nobody', 'EMPLOYER')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
  })

  it('is a no-op when the role is unchanged', async () => {
    const result = await changeUserRole(admin(), 'uid-other', 'CANDIDATE')

    expect(result.ok).toBe(true)
    expect(updateUser).not.toHaveBeenCalled()
    expect(createNotification).not.toHaveBeenCalled()
  })

  // Somebody whose role changed underneath them needs to know why their
  // workspace looks different.
  it('tells the affected person, in the same transaction', async () => {
    await changeUserRole(admin(), 'uid-other', 'EMPLOYER')

    expect(createNotification.mock.calls[0]?.[0]?.data).toMatchObject({
      userId: 'uid-other',
      type: 'SYSTEM',
    })
  })
})

describe('setUserSuspended', () => {
  it('suspends an account with a reason', async () => {
    const result = await setUserSuspended(admin(), 'uid-other', true, 'Spam listings')

    expect(result.ok).toBe(true)
    const data = updateUser.mock.calls[0]?.[0]?.data
    expect(data?.suspendedAt).toBeInstanceOf(Date)
    expect(data?.suspendedReason).toBe('Spam listings')
  })

  it('lifts a suspension and clears the reason', async () => {
    findUser.mockResolvedValue({
      id: 'uid-other',
      name: 'Rafat',
      role: 'CANDIDATE',
      suspendedAt: new Date(),
    })

    const result = await setUserSuspended(admin(), 'uid-other', false)

    expect(result.ok).toBe(true)
    expect(updateUser.mock.calls[0]?.[0]?.data).toMatchObject({
      suspendedAt: null,
      suspendedReason: null,
    })
  })

  it('refuses to suspend without a reason, so an appeal is possible', async () => {
    const result = await setUserSuspended(admin(), 'uid-other', true, '   ')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION')
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('refuses an admin suspending themselves', async () => {
    const result = await setUserSuspended(admin(), 'uid-admin', true, 'Testing')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('CONFLICT')
  })

  it('refuses suspending the last admin', async () => {
    findUser.mockResolvedValue({ id: 'uid-other', name: 'Other', role: 'ADMIN', suspendedAt: null })
    countAdmins.mockResolvedValue(1)

    const result = await setUserSuspended(admin(), 'uid-other', true, 'Testing')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('CONFLICT')
  })

  it('refuses a non-admin', async () => {
    const result = await setUserSuspended(
      { ...admin(), role: 'CANDIDATE' },
      'uid-other',
      true,
      'Because',
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN')
  })

  it('tells the person, with the reason, so they can appeal', async () => {
    await setUserSuspended(admin(), 'uid-other', true, 'Spam listings')

    expect(createNotification.mock.calls[0]?.[0]?.data?.body).toContain('Spam listings')
  })
})
