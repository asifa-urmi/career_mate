import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionUser } from '@/lib/auth/session'
import { MAX_RESUME_BYTES } from '@/config/constants'

const findProfile = vi.fn()
const countResumes = vi.fn()
const createResume = vi.fn()
const updateResume = vi.fn()
const updateManyResumes = vi.fn()
const findResume = vi.fn()
const deleteResumeRow = vi.fn()
const transaction = vi.fn()
const uploadFile = vi.fn()
const deleteFile = vi.fn()
const extract = vi.fn()

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    candidateProfile: { findUnique: findProfile },
    resume: {
      count: countResumes,
      create: createResume,
      update: updateResume,
      updateMany: updateManyResumes,
      findFirst: findResume,
      delete: deleteResumeRow,
    },
    $transaction: (ops: unknown[]) => transaction(ops),
  },
}))
vi.mock('@/lib/supabase/storage', () => ({
  uploadResumeFile: uploadFile,
  deleteResumeFile: deleteFile,
}))
vi.mock('@/lib/resume/extract', () => ({ extractText: extract }))

const { uploadResume, setPrimaryResume, deleteResume, renameResume } = await import(
  '@/server/services/resume.service'
)

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

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])
const EXE_BYTES = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00])

function upload(overrides: Partial<Parameters<typeof uploadResume>[1]> = {}) {
  return {
    fileName: 'cv.pdf',
    mimeType: 'application/pdf',
    bytes: PDF_BYTES,
    ...overrides,
  }
}

beforeEach(() => {
  for (const m of [
    findProfile,
    countResumes,
    createResume,
    updateResume,
    updateManyResumes,
    findResume,
    deleteResumeRow,
    transaction,
    uploadFile,
    deleteFile,
    extract,
  ]) {
    m.mockReset()
  }
  findProfile.mockResolvedValue({ id: 'cp-1' })
  countResumes.mockResolvedValue(0)
  createResume.mockResolvedValue({ id: 'res-1' })
  updateResume.mockResolvedValue({ id: 'res-1' })
  updateManyResumes.mockResolvedValue({ count: 1 })
  findResume.mockResolvedValue({ id: 'res-1', storagePath: 'cp-1/res-1/cv.pdf', isPrimary: false })
  deleteResumeRow.mockResolvedValue({ id: 'res-1' })
  transaction.mockResolvedValue([])
  uploadFile.mockResolvedValue({ ok: true })
  extract.mockResolvedValue('Extracted CV text')
})

describe('uploadResume', () => {
  it('stores a valid PDF and its extracted text', async () => {
    const result = await uploadResume(user(), upload())

    expect(result.ok).toBe(true)
    expect(uploadFile).toHaveBeenCalled()
    expect(updateResume.mock.calls[0]?.[0]?.data?.extractedText).toBe('Extracted CV text')
  })

  it('files the upload under the owning profile', async () => {
    await uploadResume(user(), upload())

    expect(uploadFile.mock.calls[0]?.[0]).toMatch(/^cp-1\/res-1\//)
  })

  // Review Focus 5: the client's Content-Type is whatever it chose to send.
  it('rejects an executable renamed to .pdf', async () => {
    const result = await uploadResume(user(), upload({ bytes: EXE_BYTES }))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('UNSUPPORTED_FILE_TYPE')
    expect(createResume).not.toHaveBeenCalled()
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('rejects a file over the size limit server-side', async () => {
    const result = await uploadResume(
      user(),
      upload({ bytes: new Uint8Array(MAX_RESUME_BYTES + 1) }),
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('UPLOAD_TOO_LARGE')
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('rejects an unaccepted MIME type', async () => {
    const result = await uploadResume(user(), upload({ mimeType: 'image/png' }))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('UNSUPPORTED_FILE_TYPE')
  })

  it('refuses an employer', async () => {
    const result = await uploadResume(user({ role: 'EMPLOYER' }), upload())

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN')
    expect(findProfile).not.toHaveBeenCalled()
  })

  // Extraction is best effort. A scanned PDF with no text layer must still be
  // uploadable — the file is the deliverable, the text is a bonus.
  it('still succeeds when extraction finds nothing', async () => {
    extract.mockResolvedValue('')

    const result = await uploadResume(user(), upload())

    expect(result.ok).toBe(true)
    expect(updateResume.mock.calls[0]?.[0]?.data?.extractedText).toBeNull()
  })

  // Otherwise the person has a CV in their list that points at no file.
  it('removes the row when the file upload fails', async () => {
    uploadFile.mockResolvedValue({ ok: false, message: 'storage down' })

    const result = await uploadResume(user(), upload())

    expect(result.ok).toBe(false)
    expect(deleteResumeRow).toHaveBeenCalledWith({ where: { id: 'res-1' } })
  })

  it('makes the first CV primary and later ones not', async () => {
    await uploadResume(user(), upload())
    expect(createResume.mock.calls[0]?.[0]?.data?.isPrimary).toBe(true)

    createResume.mockClear()
    countResumes.mockResolvedValue(2)
    await uploadResume(user(), upload())
    expect(createResume.mock.calls[0]?.[0]?.data?.isPrimary).toBe(false)
  })

  it('caps the number of CVs kept', async () => {
    countResumes.mockResolvedValue(10)

    const result = await uploadResume(user(), upload())

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('CONFLICT')
  })

  it('strips path characters out of the stored file name', async () => {
    await uploadResume(user(), upload({ fileName: '../../etc/passwd.pdf' }))

    const path = uploadFile.mock.calls[0]?.[0] ?? ''
    expect(path).not.toContain('..')
    expect(path.split('/')).toHaveLength(3)
  })
})

describe('setPrimaryResume', () => {
  it('clears the others and sets this one, in one transaction', async () => {
    const result = await setPrimaryResume(user(), 'res-1')

    expect(result.ok).toBe(true)
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(updateManyResumes.mock.calls[0]?.[0]?.where).toMatchObject({
      candidateProfileId: 'cp-1',
    })
  })

  it('scopes the lookup to the owner', async () => {
    await setPrimaryResume(user(), 'res-1')

    expect(findResume.mock.calls[0]?.[0]?.where).toMatchObject({
      id: 'res-1',
      candidateProfileId: 'cp-1',
    })
  })

  it('reports another candidate CV as not found', async () => {
    findResume.mockResolvedValue(null)

    const result = await setPrimaryResume(user(), 'someone-elses')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
    expect(transaction).not.toHaveBeenCalled()
  })
})

describe('deleteResume', () => {
  it('removes the row and the file', async () => {
    const result = await deleteResume(user(), 'res-1')

    expect(result.ok).toBe(true)
    expect(deleteResumeRow).toHaveBeenCalled()
    expect(deleteFile).toHaveBeenCalledWith('cp-1/res-1/cv.pdf')
  })

  it('refuses another candidate CV', async () => {
    findResume.mockResolvedValue(null)

    const result = await deleteResume(user(), 'someone-elses')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
    expect(deleteFile).not.toHaveBeenCalled()
  })

  // Otherwise the apply form has no default and silently attaches nothing.
  it('promotes another CV when the primary is deleted', async () => {
    findResume
      .mockResolvedValueOnce({ id: 'res-1', storagePath: 'p', isPrimary: true })
      .mockResolvedValueOnce({ id: 'res-2' })

    await deleteResume(user(), 'res-1')

    expect(updateResume).toHaveBeenCalledWith({
      where: { id: 'res-2' },
      data: { isPrimary: true },
    })
  })

  it('does not promote anything when the last CV is deleted', async () => {
    findResume
      .mockResolvedValueOnce({ id: 'res-1', storagePath: 'p', isPrimary: true })
      .mockResolvedValueOnce(null)

    const result = await deleteResume(user(), 'res-1')

    expect(result.ok).toBe(true)
    expect(updateResume).not.toHaveBeenCalled()
  })
})

describe('renameResume', () => {
  it('scopes the rename to the owner', async () => {
    await renameResume(user(), 'res-1', 'Finance CV')

    expect(updateManyResumes.mock.calls[0]?.[0]?.where).toMatchObject({
      id: 'res-1',
      candidateProfileId: 'cp-1',
    })
  })

  it('refuses a blank label', async () => {
    const result = await renameResume(user(), 'res-1', '   ')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION')
    expect(updateManyResumes).not.toHaveBeenCalled()
  })

  it('reports another candidate CV as not found', async () => {
    updateManyResumes.mockResolvedValue({ count: 0 })

    const result = await renameResume(user(), 'someone-elses', 'Mine now')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
  })
})
