import { describe, expect, it } from 'vitest'
import { attachedResume } from '@/lib/validation/attached-file'

/**
 * A file that rode in on a form, or nothing.
 *
 * An empty file input still submits an entry — a `File` with an empty name and
 * zero bytes — so "was anything attached?" is not the same question as "is the
 * field present?". Reading it wrong means either dropping a CV somebody chose,
 * or trying to upload a zero-byte file every time somebody skips the step.
 */
describe('attachedResume', () => {
  function file(name: string, bytes: number): File {
    return new File([new Uint8Array(bytes)], name, { type: 'application/pdf' })
  }

  it('returns a file that was actually chosen', () => {
    const chosen = file('cv.pdf', 1024)

    expect(attachedResume(chosen)).toBe(chosen)
  })

  // What an untouched file input submits.
  it('returns null for the empty entry an untouched input sends', () => {
    expect(attachedResume(file('', 0))).toBeNull()
  })

  it('returns null for a named but empty file', () => {
    expect(attachedResume(file('cv.pdf', 0))).toBeNull()
  })

  it('returns null when the field is absent altogether', () => {
    expect(attachedResume(null)).toBeNull()
  })

  // A crafted POST can put anything in a form field, including a plain string
  // where a file belongs.
  it('returns null for something that is not a file', () => {
    expect(attachedResume('cv.pdf')).toBeNull()
    expect(attachedResume(undefined)).toBeNull()
  })
})
