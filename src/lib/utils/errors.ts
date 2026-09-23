/**
 * The complete set of failures this application treats as expected outcomes
 * rather than crashes. A service returns one of these inside a `Result`; the UI
 * branches on the code. Nothing outside this union is a "handled" error.
 */
export type AppErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'QUOTA_EXHAUSTED'
  | 'UPLOAD_TOO_LARGE'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'PROVIDER_UNAVAILABLE'
  | 'INTERNAL'

export interface AppError {
  code: AppErrorCode
  message: string
  /** Per-field messages, keyed by form field name. Only set for VALIDATION. */
  fieldErrors?: Record<string, string[]>
}

export function appError(
  code: AppErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
): AppError {
  return fieldErrors ? { code, message, fieldErrors } : { code, message }
}

export function validationError(fieldErrors: Record<string, string[]>): AppError {
  return appError('VALIDATION', 'Please correct the highlighted fields.', fieldErrors)
}

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  QUOTA_EXHAUSTED: 429,
  UPLOAD_TOO_LARGE: 413,
  UNSUPPORTED_FILE_TYPE: 415,
  PROVIDER_UNAVAILABLE: 503,
  INTERNAL: 500,
}

export function httpStatusFor(code: AppErrorCode): number {
  return STATUS_BY_CODE[code]
}
