import { describe, expect, it } from 'vitest'
import { clampScore, formatTaka, initials, relativeTime } from '@/lib/utils/format'

describe('formatTaka', () => {
  it('renders a range in the prototype style', () => {
    expect(formatTaka(45000, 65000)).toBe('৳45k–65k')
  })

  it('renders an open-ended minimum', () => {
    expect(formatTaka(30000, null)).toBe('৳30k+')
  })

  it('renders a ceiling with no floor', () => {
    expect(formatTaka(null, 50000)).toBe('Up to ৳50k')
  })

  it('appends a note when one is given', () => {
    expect(formatTaka(30000, 45000, 'incentive')).toBe('৳30k–45k + incentive')
  })

  it('says nothing rather than ৳0 when there is no salary', () => {
    expect(formatTaka(null, null)).toBe('Negotiable')
  })

  it('keeps one decimal for amounts that are not whole thousands', () => {
    expect(formatTaka(45500, 65000)).toBe('৳45.5k–65k')
  })

  it('collapses an equal floor and ceiling to one figure', () => {
    expect(formatTaka(40000, 40000)).toBe('৳40k')
  })
})

describe('relativeTime', () => {
  const now = new Date('2026-09-23T12:00:00Z')

  it('uses hours within the day', () => {
    expect(relativeTime(new Date('2026-09-23T10:00:00Z'), now)).toBe('2h ago')
  })

  it('says Today for the most recent hour', () => {
    expect(relativeTime(new Date('2026-09-23T11:45:00Z'), now)).toBe('Today')
  })

  it('uses days beyond a day', () => {
    expect(relativeTime(new Date('2026-09-20T12:00:00Z'), now)).toBe('3d ago')
  })

  it('switches to weeks past a fortnight', () => {
    expect(relativeTime(new Date('2026-09-02T12:00:00Z'), now)).toBe('3w ago')
  })

  it('does not report a future date as time elapsed', () => {
    expect(relativeTime(new Date('2026-09-24T12:00:00Z'), now)).toBe('Today')
  })
})

describe('initials', () => {
  it('takes at most two initials', () => {
    expect(initials('Ayesha Karim')).toBe('AK')
    expect(initials('Mohammad Rafat Ur Rahman')).toBe('MR')
  })

  it('handles a single name', () => {
    expect(initials('Nusrat')).toBe('N')
  })

  it('does not crash on an empty name', () => {
    expect(initials('')).toBe('')
    expect(initials('   ')).toBe('')
  })

  it('ignores extra whitespace between names', () => {
    expect(initials('  Rafi   Hasan ')).toBe('RH')
  })

  it('upper-cases a lowercase name', () => {
    expect(initials('rafat rahman')).toBe('RR')
  })
})

describe('clampScore', () => {
  it('passes a normal score through', () => {
    expect(clampScore(92)).toBe(92)
  })

  it('clamps out-of-range scores into the ring', () => {
    expect(clampScore(140)).toBe(100)
    expect(clampScore(-5)).toBe(0)
  })

  it('treats a non-finite score as zero rather than emitting broken CSS', () => {
    expect(clampScore(Number.NaN)).toBe(0)
    expect(clampScore(Number.POSITIVE_INFINITY)).toBe(100)
    expect(clampScore(Number.NEGATIVE_INFINITY)).toBe(0)
  })

  it('rounds fractional scores', () => {
    expect(clampScore(87.6)).toBe(88)
  })
})
