export type UploadRejection = {
  reason: 'type' | 'size'
  message: string
}

type UploadCandidate = { type: string; size: number; name: string }

/**
 * The single upload rule, shared by the browser and the server.
 *
 * The browser runs it so the person gets an answer before uploading ten
 * megabytes. The server runs it again on the received file, and that run is the
 * one that counts — a crafted request never touches the browser copy.
 *
 * Type is checked before size so an oversized PNG reports the real problem
 * rather than sending someone off to compress a file we would refuse anyway.
 */
export function validateUpload(
  file: UploadCandidate,
  acceptedMime: readonly string[],
  maxBytes: number,
): UploadRejection | null {
  if (!acceptedMime.includes(file.type)) {
    return {
      reason: 'type',
      message: 'Only PDF and DOCX files are accepted.',
    }
  }

  if (file.size <= 0) {
    return {
      reason: 'size',
      message: 'That file is empty — the upload may not have finished.',
    }
  }

  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024))
    return {
      reason: 'size',
      message: `That file is larger than ${mb} MB.`,
    }
  }

  return null
}
