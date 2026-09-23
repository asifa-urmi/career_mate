import { describe, expect, it } from 'vitest'
import { sniffMimeType, looksLikeDeclaredType } from '@/lib/resume/sniff'

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
