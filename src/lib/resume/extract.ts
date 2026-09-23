import 'server-only'

/**
 * Pulls readable text out of a CV.
 *
 * Extraction is best effort on purpose. A scanned PDF with no text layer, an
 * exotic export, a corrupt file — all of these return an empty string rather
 * than throwing, because none of them should stop someone from having their CV
 * on file and attached to applications. The text is an enhancement: it fills the
 * profile and feeds the AI review. The file itself is the deliverable.
 */
export async function extractText(buffer: Uint8Array, mimeType: string): Promise<string> {
  try {
    if (mimeType === 'application/pdf') return await extractPdf(buffer)
    if (mimeType.includes('wordprocessingml')) return await extractDocx(buffer)
    return ''
  } catch {
    return ''
  }
}

async function extractPdf(buffer: Uint8Array): Promise<string> {
  // Imported lazily so a deployment that never sees a PDF does not pay to load
  // the parser, and so a broken install surfaces as empty text rather than a
  // module-load crash on an unrelated page.
  const { extractText: extract, getDocumentProxy } = await import('unpdf')
  const pdf = await getDocumentProxy(buffer)
  const { text } = await extract(pdf, { mergePages: true })
  return normalise(Array.isArray(text) ? text.join('\n') : text)
}

async function extractDocx(buffer: Uint8Array): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) })
  return normalise(result.value)
}

/** Collapses the ragged whitespace every extractor produces. */
function normalise(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 50_000)
}
