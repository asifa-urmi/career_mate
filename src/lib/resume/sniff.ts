/**
 * What a file actually is, from its first bytes.
 *
 * The `Content-Type` on an upload is whatever the client chose to send, and the
 * extension is whatever they named it. Neither is evidence. Before a buffer is
 * handed to a PDF or DOCX parser — or stored and later served back to an
 * employer — its header has to agree with what it claims to be.
 */

const SIGNATURES: { bytes: number[]; mime: string }[] = [
  { bytes: [0x25, 0x50, 0x44, 0x46], mime: 'application/pdf' }, // %PDF
  { bytes: [0x50, 0x4b, 0x03, 0x04], mime: 'application/zip' }, // PK.. — DOCX is a zip
  { bytes: [0x50, 0x4b, 0x05, 0x06], mime: 'application/zip' }, // empty archive
  { bytes: [0x4d, 0x5a], mime: 'application/x-msdownload' }, // MZ — Windows executable
  { bytes: [0x7f, 0x45, 0x4c, 0x46], mime: 'application/x-elf' }, // ELF
  { bytes: [0x89, 0x50, 0x4e, 0x47], mime: 'image/png' },
  { bytes: [0xff, 0xd8, 0xff], mime: 'image/jpeg' },
  { bytes: [0x47, 0x49, 0x46, 0x38], mime: 'image/gif' },
  { bytes: [0x1f, 0x8b], mime: 'application/gzip' },
]

/** The shortest signature worth testing. Anything smaller is not a document. */
const MIN_BYTES = 4

export function sniffMimeType(buffer: Uint8Array): string | null {
  if (buffer.length < MIN_BYTES) return null

  for (const { bytes, mime } of SIGNATURES) {
    if (bytes.every((byte, i) => buffer[i] === byte)) return mime
  }

  return null
}

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/**
 * Whether the bytes are consistent with the declared type.
 *
 * DOCX can only be checked as far as "it is a zip"; whether that zip is really a
 * Word document is settled by the parser opening it, which happens next. That is
 * enough here — the point is to stop an executable or an image being stored and
 * later handed to an employer as someone's CV.
 */
export function looksLikeDeclaredType(buffer: Uint8Array, declared: string): boolean {
  const actual = sniffMimeType(buffer)
  if (!actual) return false

  if (declared === 'application/pdf') return actual === 'application/pdf'
  if (declared === DOCX) return actual === 'application/zip'

  return false
}
