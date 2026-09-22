import type { AppError } from './errors'

/**
 * Expected failures travel as values, not exceptions, so the UI can render each
 * one differently without parsing error strings. Anything unexpected still
 * throws and is caught by a route-group error boundary.
 */
export type Result<T> = { ok: true; value: T } | { ok: false; error: AppError }

export function ok<T>(value: T): Result<T> {
  return { ok: true, value }
}

export function err<T = never>(error: AppError): Result<T> {
  return { ok: false, error }
}
