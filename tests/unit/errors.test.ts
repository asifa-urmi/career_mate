import { describe, expect, it } from 'vitest'
import { appError, validationError, httpStatusFor } from '@/lib/utils/errors'

describe('errors', () => {
  it('validationError collects field errors under the VALIDATION code', () => {
    const e = validationError({ email: ['Enter a valid email address'] })
    expect(e.code).toBe('VALIDATION')
    expect(e.fieldErrors?.email).toEqual(['Enter a valid email address'])
  })

  it('maps every code to an HTTP status', () => {
    expect(httpStatusFor('UNAUTHENTICATED')).toBe(401)
    expect(httpStatusFor('FORBIDDEN')).toBe(403)
    expect(httpStatusFor('NOT_FOUND')).toBe(404)
    expect(httpStatusFor('VALIDATION')).toBe(422)
    expect(httpStatusFor('CONFLICT')).toBe(409)
    expect(httpStatusFor('RATE_LIMITED')).toBe(429)
    expect(httpStatusFor('QUOTA_EXHAUSTED')).toBe(429)
    expect(httpStatusFor('UPLOAD_TOO_LARGE')).toBe(413)
    expect(httpStatusFor('UNSUPPORTED_FILE_TYPE')).toBe(415)
    expect(httpStatusFor('PROVIDER_UNAVAILABLE')).toBe(503)
    expect(httpStatusFor('INTERNAL')).toBe(500)
  })

  it('appError keeps the message it was given', () => {
    expect(appError('CONFLICT', 'Already applied').message).toBe('Already applied')
  })
})
