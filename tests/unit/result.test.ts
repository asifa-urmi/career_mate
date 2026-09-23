import { describe, expect, it } from 'vitest'
import { ok, err } from '@/lib/utils/result'
import { appError } from '@/lib/utils/errors'

describe('Result', () => {
  it('ok carries the value and narrows', () => {
    const r = ok(42)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBe(42)
  })

  it('err carries the error and narrows', () => {
    const e = appError('NOT_FOUND', 'Job not found')
    const r = err(e)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('NOT_FOUND')
  })

  it('ok(undefined) is still a success', () => {
    expect(ok(undefined).ok).toBe(true)
  })
})
