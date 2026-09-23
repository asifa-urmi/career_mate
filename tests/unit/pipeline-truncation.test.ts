import { describe, expect, it } from 'vitest'
import { PIPELINE_LIMIT, describePipeline } from '@/lib/db/repositories/analytics.repository'

/**
 * The board reads a bounded number of rows, and says so when that bites.
 *
 * It took 300 and the page reported the length of what came back as "N
 * candidates in progress". At 301 in-pipeline applications candidates silently
 * vanished from the board and the headline number was wrong, with nothing on
 * screen suggesting either. A board a busy employer cannot trust to be complete
 * is worse than one that admits where it stops.
 */
describe('describePipeline', () => {
  it('counts what is in progress', () => {
    expect(describePipeline(0, 0)).toBe('Candidates appear here as they apply.')
    expect(describePipeline(1, 1)).toBe('1 candidate in progress.')
    expect(describePipeline(12, 12)).toBe('12 candidates in progress.')
  })

  it('says nothing about truncation when nothing was truncated', () => {
    expect(describePipeline(PIPELINE_LIMIT - 1, PIPELINE_LIMIT - 1)).not.toMatch(/most recent/i)
  })

  // total is what the database says; shown is what the board holds.
  it('admits the board is not the whole picture once it fills up', () => {
    const description = describePipeline(PIPELINE_LIMIT, PIPELINE_LIMIT + 42)

    expect(description).toContain(String(PIPELINE_LIMIT + 42))
    expect(description).toMatch(/most recent/i)
  })

  it('reports the real total rather than the number of cards', () => {
    expect(describePipeline(300, 512)).toContain('512')
  })

  it('exposes a limit the page can compare against', () => {
    expect(PIPELINE_LIMIT).toBeGreaterThan(0)
  })
})
