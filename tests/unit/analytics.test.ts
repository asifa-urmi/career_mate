import { describe, expect, it } from 'vitest'
import {
  averageDays,
  buildFunnel,
  bucketByDay,
  conversionRate,
} from '@/lib/analytics/compute'

describe('buildFunnel', () => {
  // The funnel is cumulative: someone at OFFER passed through SCREENING, even
  // though their row only records where they are now. Counting raw stages would
  // draw a funnel that widens in the middle.
  it('counts each stage as everyone who reached it or beyond', () => {
    const funnel = buildFunnel({
      APPLIED: 10,
      SCREENING: 6,
      INTERVIEW: 3,
      ASSESSMENT: 0,
      OFFER: 2,
      REJECTED: 4,
      WITHDRAWN: 1,
    })

    const at = (key: string) => funnel.find((s) => s.key === key)?.count

    // 21 still in the pipeline plus the 5 who left it: 26 people applied.
    expect(at('APPLIED')).toBe(26)
    expect(at('SCREENING')).toBe(11)
    expect(at('INTERVIEW')).toBe(5)
    expect(at('ASSESSMENT')).toBe(2)
    expect(at('OFFER')).toBe(2)
  })

  it('returns every stage even when nothing has happened', () => {
    const funnel = buildFunnel({
      APPLIED: 0,
      SCREENING: 0,
      INTERVIEW: 0,
      ASSESSMENT: 0,
      OFFER: 0,
      REJECTED: 0,
      WITHDRAWN: 0,
    })

    expect(funnel).toHaveLength(5)
    expect(funnel.every((s) => s.count === 0)).toBe(true)
  })

  it('never reports a later stage as wider than an earlier one', () => {
    const funnel = buildFunnel({
      APPLIED: 1,
      SCREENING: 2,
      INTERVIEW: 3,
      ASSESSMENT: 4,
      OFFER: 5,
      REJECTED: 0,
      WITHDRAWN: 0,
    })

    for (let i = 1; i < funnel.length; i++) {
      expect(funnel[i]!.count).toBeLessThanOrEqual(funnel[i - 1]!.count)
    }
  })
})

describe('conversionRate', () => {
  it('is a percentage of the first stage', () => {
    expect(conversionRate(25, 100)).toBe(25)
  })

  // Division by zero is how a dashboard ends up showing "NaN%" on its first day.
  it('is zero rather than NaN when nothing has entered the funnel', () => {
    expect(conversionRate(0, 0)).toBe(0)
    expect(conversionRate(5, 0)).toBe(0)
  })

  it('never exceeds 100', () => {
    expect(conversionRate(150, 100)).toBe(100)
  })
})

describe('bucketByDay', () => {
  const now = new Date('2026-09-23T12:00:00Z')

  it('returns one bucket per day, including days with nothing', () => {
    const buckets = bucketByDay([new Date('2026-09-23T09:00:00Z')], 7, now)

    expect(buckets).toHaveLength(7)
    expect(buckets.at(-1)?.count).toBe(1)
    expect(buckets[0]?.count).toBe(0)
  })

  it('groups several events on the same day', () => {
    const buckets = bucketByDay(
      [
        new Date('2026-09-23T01:00:00Z'),
        new Date('2026-09-23T09:00:00Z'),
        new Date('2026-09-22T09:00:00Z'),
      ],
      7,
      now,
    )

    expect(buckets.at(-1)?.count).toBe(2)
    expect(buckets.at(-2)?.count).toBe(1)
  })

  it('ignores events older than the window rather than piling them on day one', () => {
    const buckets = bucketByDay([new Date('2020-01-01T00:00:00Z')], 7, now)
    expect(buckets.every((b) => b.count === 0)).toBe(true)
  })

  it('labels every bucket', () => {
    for (const bucket of bucketByDay([], 7, now)) {
      expect(bucket.label.length).toBeGreaterThan(0)
    }
  })
})

describe('averageDays', () => {
  it('averages the gaps in days', () => {
    expect(
      averageDays([
        [new Date('2026-09-01T00:00:00Z'), new Date('2026-09-03T00:00:00Z')],
        [new Date('2026-09-01T00:00:00Z'), new Date('2026-09-05T00:00:00Z')],
      ]),
    ).toBe(3)
  })

  // Applications nobody has touched have no gap to measure. Counting them as
  // zero would report an instant response time for an ignored inbox.
  it('is null with nothing to average, rather than zero', () => {
    expect(averageDays([])).toBeNull()
  })

  it('ignores a pair whose end is before its start', () => {
    expect(
      averageDays([
        [new Date('2026-09-05T00:00:00Z'), new Date('2026-09-01T00:00:00Z')],
        [new Date('2026-09-01T00:00:00Z'), new Date('2026-09-03T00:00:00Z')],
      ]),
    ).toBe(2)
  })

  it('rounds to one decimal, because a response time is not exact to the second', () => {
    expect(
      averageDays([[new Date('2026-09-01T00:00:00Z'), new Date('2026-09-01T12:00:00Z')]]),
    ).toBe(0.5)
  })
})
