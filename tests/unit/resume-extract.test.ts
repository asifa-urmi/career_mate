import { describe, expect, it } from 'vitest'
import { looksLikeDeclaredType, looksLikeImage, sniffMimeType } from '@/lib/resume/sniff'

/** The first bytes of each real format. */
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])
const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00])
const EXE = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00])
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

describe('sniffMimeType', () => {
  it('recognises a PDF by its header', () => {
    expect(sniffMimeType(PDF)).toBe('application/pdf')
  })

  // DOCX is a zip. This is as far as magic bytes can take it — the real check is
  // whether the DOCX parser can open it, which the upload does next.
  it('recognises a zip container, which is what a DOCX is', () => {
    expect(sniffMimeType(ZIP)).toBe('application/zip')
  })

  it('recognises an executable', () => {
    expect(sniffMimeType(EXE)).toBe('application/x-msdownload')
  })

  it('returns null for bytes it does not know', () => {
    expect(sniffMimeType(PNG)).toBe('image/png')
    expect(sniffMimeType(new Uint8Array([1, 2, 3, 4]))).toBeNull()
  })

  it('does not crash on an empty or truncated buffer', () => {
    expect(sniffMimeType(new Uint8Array())).toBeNull()
    expect(sniffMimeType(new Uint8Array([0x25, 0x50]))).toBeNull()
  })
})

describe('looksLikeDeclaredType', () => {
  it('accepts a real PDF declared as a PDF', () => {
    expect(looksLikeDeclaredType(PDF, 'application/pdf')).toBe(true)
  })

  it('accepts a real DOCX, which is a zip, declared as a DOCX', () => {
    expect(looksLikeDeclaredType(ZIP, DOCX)).toBe(true)
  })

  // Review Focus 5: the browser's Content-Type is whatever the client says it
  // is. A renamed executable arrives claiming to be a PDF.
  it('rejects an executable renamed to .pdf', () => {
    expect(looksLikeDeclaredType(EXE, 'application/pdf')).toBe(false)
  })

  it('rejects a PNG renamed to .docx', () => {
    expect(looksLikeDeclaredType(PNG, DOCX)).toBe(false)
  })

  it('rejects a PDF declared as a DOCX, so the parser is never handed the wrong format', () => {
    expect(looksLikeDeclaredType(PDF, DOCX)).toBe(false)
  })

  it('rejects bytes it cannot identify at all', () => {
    expect(looksLikeDeclaredType(new Uint8Array([1, 2, 3, 4]), 'application/pdf')).toBe(false)
  })

  it('rejects an empty file', () => {
    expect(looksLikeDeclaredType(new Uint8Array(), 'application/pdf')).toBe(false)
  })
})

/**
 * An avatar is stored in a public bucket and served back to everyone who sees
 * the person — on an application, in a thread, in the admin user list. So what
 * lands there has to be an image in fact, not merely by its declared type: a
 * `Content-Type` is whatever the client chose to send.
 */
describe('looksLikeImage', () => {
  function bytes(...values: number[]): Uint8Array {
    return new Uint8Array([...values, 0, 0, 0, 0])
  }

  const PNG = bytes(0x89, 0x50, 0x4e, 0x47)
  const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0)

  it('accepts a PNG declared as a PNG', () => {
    expect(looksLikeImage(PNG, 'image/png')).toBe(true)
  })

  it('accepts a JPEG declared as a JPEG', () => {
    expect(looksLikeImage(JPEG, 'image/jpeg')).toBe(true)
  })

  it('accepts a WebP, which phones now produce by default', () => {
    // RIFF....WEBP — the tag sits at offset 8, not at the start.
    const webp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ])

    expect(looksLikeImage(webp, 'image/webp')).toBe(true)
  })

  it('refuses a JPEG renamed as a PNG', () => {
    expect(looksLikeImage(JPEG, 'image/png')).toBe(false)
  })

  // The whole point: something executable, stored and then served from a URL
  // every visitor's browser loads.
  it('refuses an executable calling itself an image', () => {
    expect(looksLikeImage(bytes(0x4d, 0x5a), 'image/png')).toBe(false)
    expect(looksLikeImage(bytes(0x7f, 0x45, 0x4c, 0x46), 'image/jpeg')).toBe(false)
  })

  it('refuses a PDF calling itself an image', () => {
    expect(looksLikeImage(bytes(0x25, 0x50, 0x44, 0x46), 'image/png')).toBe(false)
  })

  it('refuses an SVG, which is a script that renders', () => {
    const svg = new TextEncoder().encode('<svg onload="alert(1)"></svg>')

    expect(looksLikeImage(svg, 'image/svg+xml')).toBe(false)
  })

  it('refuses something too short to identify', () => {
    expect(looksLikeImage(new Uint8Array([0x89]), 'image/png')).toBe(false)
  })
})
