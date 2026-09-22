import { describe, expect, it } from 'vitest'
import { buildSearchClause } from '@/lib/db/repositories/job-search'

describe('buildSearchClause', () => {
  it('returns nothing for a blank search, so the listing is unfiltered', () => {
    expect(buildSearchClause('')).toBeUndefined()
    expect(buildSearchClause('   ')).toBeUndefined()
  })

  it('matches title, summary and company name case-insensitively', () => {
    const clause = buildSearchClause('accountant')
    const or = clause?.OR ?? []
    expect(or).toContainEqual({ title: { contains: 'accountant', mode: 'insensitive' } })
    expect(or).toContainEqual({ summary: { contains: 'accountant', mode: 'insensitive' } })
    expect(or).toContainEqual({
      company: { name: { contains: 'accountant', mode: 'insensitive' } },
    })
  })

  // The search box offers "title, company or skill". `has` is an exact,
  // case-sensitive array match, so searching "react" against a job whose
  // requiredSkills holds "React" silently returned nothing — the skill third of
  // the promise was dead.
  it('matches a skill regardless of how the searcher capitalised it', () => {
    const clause = buildSearchClause('react')
    const or = clause?.OR ?? []
    const skillClause = or.find((c) => 'requiredSkills' in c)
    expect(skillClause).toBeDefined()
    expect(JSON.stringify(skillClause)).not.toContain('"has"')
  })

  it('matches a multi-word skill', () => {
    const clause = buildSearchClause('meta ads')
    expect(JSON.stringify(clause)).toContain('meta ads')
  })

  it('trims surrounding whitespace rather than searching for it', () => {
    const clause = buildSearchClause('  python  ')
    expect(JSON.stringify(clause)).toContain('python')
    expect(JSON.stringify(clause)).not.toContain('  python')
  })

  it('treats a percent sign as a literal, not a wildcard', () => {
    const clause = buildSearchClause('100%')
    expect(JSON.stringify(clause)).toContain('100%')
  })
})
