import { describe, expect, it } from 'vitest'
import { validateUpload } from '@/lib/validation/file'
import { ACCEPTED_RESUME_MIME, MAX_RESUME_BYTES } from '@/config/constants'

const pdf = 'application/pdf'
const docx = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

function file(overrides: Partial<{ type: string; size: number; name: string }> = {}) {
  return { type: pdf, size: 1024, name: 'cv.pdf', ...overrides }
}

describe('validateUpload', () => {
  it('accepts a small PDF', () => {
    expect(validateUpload(file(), ACCEPTED_RESUME_MIME, MAX_RESUME_BYTES)).toBeNull()
  })

  it('accepts a DOCX', () => {
    expect(
      validateUpload(file({ type: docx, name: 'cv.docx' }), ACCEPTED_RESUME_MIME, MAX_RESUME_BYTES),
    ).toBeNull()
  })

  it('rejects an unaccepted type and says which types are allowed', () => {
    const result = validateUpload(
      file({ type: 'image/png', name: 'cv.png' }),
      ACCEPTED_RESUME_MIME,
      MAX_RESUME_BYTES,
    )
    expect(result?.reason).toBe('type')
    expect(result?.message).toMatch(/PDF/i)
  })

  it('rejects a file over the limit and names the limit', () => {
    const result = validateUpload(
      file({ size: MAX_RESUME_BYTES + 1 }),
      ACCEPTED_RESUME_MIME,
      MAX_RESUME_BYTES,
    )
    expect(result?.reason).toBe('size')
    expect(result?.message).toMatch(/10 MB/)
  })

  it('accepts a file exactly at the limit', () => {
    expect(
      validateUpload(file({ size: MAX_RESUME_BYTES }), ACCEPTED_RESUME_MIME, MAX_RESUME_BYTES),
    ).toBeNull()
  })

  it('rejects an empty file, which is a failed read rather than a CV', () => {
    const result = validateUpload(file({ size: 0 }), ACCEPTED_RESUME_MIME, MAX_RESUME_BYTES)
    expect(result?.reason).toBe('size')
  })

  it('rejects a type check before a size check, so a huge PNG reports the type', () => {
    const result = validateUpload(
      file({ type: 'image/png', size: MAX_RESUME_BYTES * 2 }),
      ACCEPTED_RESUME_MIME,
      MAX_RESUME_BYTES,
    )
    expect(result?.reason).toBe('type')
  })
})
