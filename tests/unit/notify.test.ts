import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const findUnique = vi.fn()
const create = vi.fn()

// The real handle is Prisma's transaction client. These two models are all
// notifyUser touches, so the cast narrows the mock rather than widening it.
const tx = { user: { findUnique }, notification: { create } } as unknown as NotifyTx

const { notifyUser } = await import('@/lib/db/repositories/notification.repository')
type NotifyTx = Parameters<typeof notifyUser>[0]

beforeEach(() => {
  findUnique.mockReset()
  create.mockReset()
  findUnique.mockResolvedValue({ notifyOn: ['APPLICATION_UPDATE', 'NEW_MESSAGE', 'JOB_MATCH'] })
  create.mockResolvedValue({ id: 'n-1' })
})

const payload = {
  type: 'APPLICATION_UPDATE' as const,
  title: 'Your application moved',
  body: 'To interview.',
  href: '/tracker',
}

describe('notifyUser', () => {
  it('writes a notification of a type the person asked for', async () => {
    await notifyUser(tx, 'uid-1', payload)

    expect(create).toHaveBeenCalledWith({ data: { userId: 'uid-1', ...payload } })
  })

  // The settings panel says "Saved." and then nothing changes — a control that
  // lies is worse than no control.
  it('writes nothing of a type the person turned off', async () => {
    findUnique.mockResolvedValue({ notifyOn: ['NEW_MESSAGE'] })

    await notifyUser(tx, 'uid-1', payload)

    expect(create).not.toHaveBeenCalled()
  })

  it('reads the preference of the recipient, not of whoever triggered it', async () => {
    await notifyUser(tx, 'uid-1', payload)

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'uid-1' },
      select: { notifyOn: true },
    })
  })

  /**
   * SYSTEM covers suspensions, moderation outcomes and account changes. Someone
   * who turns notifications off is not thereby opting out of being told their
   * account was suspended — that is the one message they most need.
   */
  it('always delivers a SYSTEM notice, whatever the preferences say', async () => {
    findUnique.mockResolvedValue({ notifyOn: [] })

    await notifyUser(tx, 'uid-1', { ...payload, type: 'SYSTEM' })

    expect(create).toHaveBeenCalled()
  })

  it('writes nothing when the recipient no longer exists', async () => {
    findUnique.mockResolvedValue(null)

    await notifyUser(tx, 'uid-1', payload)

    expect(create).not.toHaveBeenCalled()
  })
})

/**
 * One place decides, so a preference cannot be honoured by one writer and
 * ignored by four others — which is exactly what happened: only messages
 * consulted `notifyOn`, so three of the four toggles in settings did nothing
 * at all.
 */
describe('every notification writer goes through notifyUser', () => {
  const SERVICES = join(process.cwd(), 'src', 'server', 'services')

  it('has no service calling notification.create directly', () => {
    const offenders = readdirSync(SERVICES)
      .filter((f) => f.endsWith('.ts'))
      .filter((f) => /\.notification\.create\(/.test(readFileSync(join(SERVICES, f), 'utf8')))

    expect(
      offenders,
      `services writing notifications without checking preferences: ${offenders.join(', ')}`,
    ).toEqual([])
  })
})
