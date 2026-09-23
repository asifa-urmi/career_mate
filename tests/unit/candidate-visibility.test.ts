import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The employer's stage-change note is internal.
 *
 * `stage-control.tsx` tells the employer it is "recorded in the history, not
 * shown to the candidate". Anything the candidate can reach must therefore not
 * select it or render it — a promise the UI makes and the data layer breaks is
 * worse than no promise, because the employer writes differently under it.
 */
const repository = readFileSync('src/lib/db/repositories/application.repository.ts', 'utf8')
const trackerRow = readFileSync('src/components/applications/tracker-row.tsx', 'utf8')
const stageControl = readFileSync('src/components/employer/stage-control.tsx', 'utf8')

/**
 * The `select` inside the events block of the candidate-facing read.
 *
 * Anchored on `events:` then the first `select: { … }` after it. A lazy match up
 * to the first `},` would stop at the orderBy and capture nothing, which would
 * make every "does not contain" assertion pass for the wrong reason.
 */
function candidateEventSelect(): string {
  const body = /findCandidateApplication[\s\S]*$/.exec(repository)?.[0] ?? ''
  const match = /events: \{[\s\S]*?select: \{([^}]*)\}/.exec(body)
  return match?.[1] ?? ''
}

describe('employer stage notes stay internal', () => {
  it('the employer is told the note is not shown to the candidate', () => {
    expect(stageControl).toMatch(/not shown to the candidate/i)
  })

  it('the candidate-facing query does not select the note', () => {
    expect(candidateEventSelect()).not.toMatch(/note:\s*true/)
  })

  it("the candidate's tracker does not render a note", () => {
    expect(trackerRow).not.toMatch(/event\.note/)
  })

  it('the candidate-facing query still selects the stage transition itself', () => {
    const select = candidateEventSelect()
    expect(select).toMatch(/fromStage:\s*true/)
    expect(select).toMatch(/toStage:\s*true/)
  })
})
