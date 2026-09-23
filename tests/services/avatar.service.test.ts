import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionUser } from '@/lib/auth/session'
import { MAX_AVATAR_BYTES } from '@/config/constants'

const updateUser = vi.fn()
const findUser = vi.fn()
const uploadAvatarFile = vi.fn()
const deleteAvatarFile = vi.fn()

vi.mock('@/lib/db/prisma', () => ({
  prisma: { user: { update: updateUser, findUnique: findUser } },
}))
vi.mock('@/lib/supabase/storage', () => ({ uploadAvatarFile, deleteAvatarFile }))

const { updateAvatar, removeAvatar } = await import('@/server/services/avatar.service')

function user(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'uid-1',
    email: 'a@b.com',
    name: 'Rafat',
    avatarUrl: null,
    role: 'CANDIDATE',
    onboardedAt: new Date(),
    onboarded: true,
    ...overrides,
  }
}

/** A real PNG header, so the magic-byte check passes. */
function png(size = 2048): Uint8Array {
  const bytes = new Uint8Array(size)
  bytes.set([0x89, 0x50, 0x4e, 0x47], 0)
  return bytes
}

beforeEach(() => {
  for (const m of [updateUser, findUser, uploadAvatarFile, deleteAvatarFile]) m.mockReset()
  updateUser.mockResolvedValue({ id: 'uid-1' })
  findUser.mockResolvedValue({ avatarUrl: null })
  uploadAvatarFile.mockResolvedValue({ ok: true, url: 'https://cdn.example/avatars/uid-1/a.png' })
  deleteAvatarFile.mockResolvedValue(undefined)
})

describe('updateAvatar', () => {
  it('stores the photo and saves the URL on the caller own row', async () => {
    const result = await updateAvatar(user(), {
      fileName: 'me.png',
      mimeType: 'image/png',
      bytes: png(),
    })

    expect(result.ok).toBe(true)
    expect(updateUser.mock.calls[0]?.[0]?.where).toEqual({ id: 'uid-1' })
    expect(updateUser.mock.calls[0]?.[0]?.data?.avatarUrl).toBe(
      'https://cdn.example/avatars/uid-1/a.png',
    )
  })

  // The bucket is public, so a guessable path would let anyone walk it by user
  // id and collect every face on the platform.
  it('stores under a path that cannot be guessed from the user id alone', async () => {
    await updateAvatar(user(), { fileName: 'me.png', mimeType: 'image/png', bytes: png() })
    const first = uploadAvatarFile.mock.calls[0]?.[0]

    uploadAvatarFile.mockClear()
    await updateAvatar(user(), { fileName: 'me.png', mimeType: 'image/png', bytes: png() })
    const second = uploadAvatarFile.mock.calls[0]?.[0]

    expect(first).toContain('uid-1/')
    expect(first).not.toBe(second)
  })

  it('refuses a file larger than the limit, without storing it', async () => {
    const result = await updateAvatar(user(), {
      fileName: 'huge.png',
      mimeType: 'image/png',
      bytes: png(MAX_AVATAR_BYTES + 1),
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('UPLOAD_TOO_LARGE')
    expect(uploadAvatarFile).not.toHaveBeenCalled()
  })

  it('refuses a type that is not an accepted image', async () => {
    const result = await updateAvatar(user(), {
      fileName: 'cv.pdf',
      mimeType: 'application/pdf',
      bytes: png(),
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('UNSUPPORTED_FILE_TYPE')
    expect(uploadAvatarFile).not.toHaveBeenCalled()
  })

  /**
   * The declared type is whatever the client sent. This file goes into a public
   * bucket and is loaded by every visitor's browser, so what it actually is
   * matters more here than anywhere else.
   */
  it('refuses bytes that are not the image they claim to be', async () => {
    const executable = new Uint8Array(2048)
    executable.set([0x4d, 0x5a], 0)

    const result = await updateAvatar(user(), {
      fileName: 'me.png',
      mimeType: 'image/png',
      bytes: executable,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('UNSUPPORTED_FILE_TYPE')
    expect(uploadAvatarFile).not.toHaveBeenCalled()
  })

  it('reports a storage failure rather than saving a URL that serves nothing', async () => {
    uploadAvatarFile.mockResolvedValue({ ok: false, message: 'bucket missing' })

    const result = await updateAvatar(user(), {
      fileName: 'me.png',
      mimeType: 'image/png',
      bytes: png(),
    })

    expect(result.ok).toBe(false)
    expect(updateUser).not.toHaveBeenCalled()
  })

  // Or every replacement leaves its predecessor in the bucket forever.
  it('removes the photo it replaced', async () => {
    findUser.mockResolvedValue({ avatarUrl: 'https://cdn.example/avatars/uid-1/old.png' })

    await updateAvatar(user(), { fileName: 'me.png', mimeType: 'image/png', bytes: png() })

    expect(deleteAvatarFile).toHaveBeenCalledWith('uid-1/old.png')
  })
})

describe('removeAvatar', () => {
  it('clears the row and deletes the object', async () => {
    findUser.mockResolvedValue({ avatarUrl: 'https://cdn.example/avatars/uid-1/old.png' })

    const result = await removeAvatar(user())

    expect(result.ok).toBe(true)
    expect(updateUser.mock.calls[0]?.[0]?.data?.avatarUrl).toBeNull()
    expect(deleteAvatarFile).toHaveBeenCalledWith('uid-1/old.png')
  })

  it('is a no-op when there is no photo', async () => {
    const result = await removeAvatar(user())

    expect(result.ok).toBe(true)
    expect(deleteAvatarFile).not.toHaveBeenCalled()
  })

  it('only ever touches the caller own row', async () => {
    findUser.mockResolvedValue({ avatarUrl: 'https://cdn.example/avatars/uid-1/old.png' })

    await removeAvatar(user())

    expect(findUser.mock.calls[0]?.[0]?.where).toEqual({ id: 'uid-1' })
    expect(updateUser.mock.calls[0]?.[0]?.where).toEqual({ id: 'uid-1' })
  })
})

/**
 * A storage failure has to say which one it is.
 *
 * "We could not save that photo. Please try again." is the same for a bucket
 * that was never created, a key that never reached the server, and a transient
 * network fault — and only the third is worth trying again. Whoever runs the
 * site is the one who can fix the first two, and they cannot fix what they are
 * not told.
 */
describe('what a failed upload says', () => {
  it('names a missing bucket, because retrying will never create one', async () => {
    uploadAvatarFile.mockResolvedValue({ ok: false, message: 'Bucket not found' })

    const result = await updateAvatar(user(), {
      fileName: 'me.png',
      mimeType: 'image/png',
      bytes: png(),
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toMatch(/not set up|not configured/i)
      expect(result.error.message).not.toMatch(/try again/i)
    }
  })

  it('names missing configuration when the server has no storage credentials', async () => {
    uploadAvatarFile.mockRejectedValue(
      new Error('Invalid environment configuration:\n  SUPABASE_SERVICE_ROLE_KEY: required'),
    )

    const result = await updateAvatar(user(), {
      fileName: 'me.png',
      mimeType: 'image/png',
      bytes: png(),
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toMatch(/not set up|not configured/i)
  })

  // A real transient fault is the one case where trying again is the right advice.
  it('still says to try again for an ordinary failure', async () => {
    uploadAvatarFile.mockResolvedValue({ ok: false, message: 'socket hang up' })

    const result = await updateAvatar(user(), {
      fileName: 'me.png',
      mimeType: 'image/png',
      bytes: png(),
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toMatch(/try again/i)
  })
})
