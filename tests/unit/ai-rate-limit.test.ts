import { describe, expect, it } from 'vitest'
import {
  RATE_LIMITS,
  RATE_WINDOW_MS,
  rateLimitMessage,
  windowStart,
  withinLimit,
} from '@/lib/ai/rate-limit'
import type { AiFeature } from '@/lib/ai/types'

const FEATURES: AiFeature[] = [
  'match-explain',
  'cv-review',
  'cover-letter',
  'interview-questions',
  'coach-chat',
]

describe('the AI rate limit', () => {
  it('sets a limit for every feature, so none is unlimited by omission', () => {
    for (const feature of FEATURES) {
      expect(RATE_LIMITS[feature], `${feature} has no limit`).toBeGreaterThan(0)
    }
  })

  it('allows a first request', () => {
    expect(withinLimit('coach-chat', 0)).toBe(true)
  })

  it('allows the last request inside the limit', () => {
    expect(withinLimit('cv-review', RATE_LIMITS['cv-review'] - 1)).toBe(true)
  })

  it('refuses the one past it', () => {
    expect(withinLimit('cv-review', RATE_LIMITS['cv-review'])).toBe(false)
  })

  it('refuses anything beyond it', () => {
    expect(withinLimit('cv-review', RATE_LIMITS['cv-review'] + 500)).toBe(false)
  })

  // Ordinary use must never meet these. Revising a cover letter ten times in an
  // hour is real; two hundred times is not.
  it('leaves room for ordinary use', () => {
    expect(RATE_LIMITS['cover-letter']).toBeGreaterThanOrEqual(10)
    expect(RATE_LIMITS['coach-chat']).toBeGreaterThanOrEqual(30)
  })

  it('counts over an hour', () => {
    const now = new Date('2026-09-23T12:00:00Z')

    expect(now.getTime() - windowStart(now).getTime()).toBe(RATE_WINDOW_MS)
    expect(windowStart(now).toISOString()).toBe('2026-09-23T11:00:00.000Z')
  })

  // A bare "too many requests" leaves someone refreshing, which is the very
  // behaviour the limit exists to discourage.
  it('says what the limit was and that it lifts', () => {
    const message = rateLimitMessage('cv-review')

    expect(message).toContain(String(RATE_LIMITS['cv-review']))
    expect(message).toMatch(/try again/i)
  })
})
