import { describe, expect, it } from 'vitest'
import { companyInitials } from '@/lib/utils/company'

describe('companyInitials', () => {
  it('takes the first letter of the first two words', () => {
    expect(companyInitials('Nexa Labs')).toBe('NL')
    expect(companyInitials('BluePeak Consumer')).toBe('BC')
  })

  it('takes the first two letters of a single word', () => {
    expect(companyInitials('Meridian')).toBe('ME')
  })

  it('ignores extra whitespace', () => {
    expect(companyInitials('  Green   Life  ')).toBe('GL')
  })

  it('upper-cases a lowercase name', () => {
    expect(companyInitials('atlas manufacturing')).toBe('AM')
  })

  it('skips words that start with punctuation or a symbol', () => {
    expect(companyInitials('& Finance Collective')).toBe('FC')
  })

  it('handles a one-letter name without padding it out', () => {
    expect(companyInitials('X')).toBe('X')
  })

  it('never returns an empty monogram, because the avatar would be a blank square', () => {
    expect(companyInitials('')).toBe('??')
    expect(companyInitials('   ')).toBe('??')
  })

  it('always returns at most two characters', () => {
    for (const name of ['Nexa Labs', 'A Very Long Company Name Ltd', 'X', '']) {
      expect(companyInitials(name).length).toBeLessThanOrEqual(2)
    }
  })
})
