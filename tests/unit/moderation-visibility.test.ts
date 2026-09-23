import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A moderator approves what they can see.
 *
 * The queue selected and rendered only `summary`, so the parts of a listing a
 * candidate actually reads — the responsibilities and the requirements — were
 * approved by someone who had never seen them. That is where a plausible-looking
 * job hides its "email a scan of your national ID to verify@…" line: not in the
 * blurb, in the requirements.
 *
 * Reading the source rather than running a query, because there is no database
 * in this suite. What this pins is that the fields are both fetched and shown.
 */
describe('the moderation queue shows what it is approving', () => {
  const repository = readFileSync(
    join(process.cwd(), 'src', 'lib', 'db', 'repositories', 'employer.repository.ts'),
    'utf8',
  )
  const row = readFileSync(
    join(process.cwd(), 'src', 'components', 'admin', 'moderation-row.tsx'),
    'utf8',
  )

  it('carries the full job body on the queue item', () => {
    const type = /export type ModerationQueueItem = \{([\s\S]*?)\n\}/.exec(repository)?.[1] ?? ''

    for (const field of ['summary', 'responsibilities', 'requirements']) {
      expect(type, `ModerationQueueItem has no ${field}`).toContain(field)
    }
  })

  it('renders every part of the body a candidate would read', () => {
    for (const field of ['summary', 'responsibilities', 'requirements']) {
      expect(row, `the moderation row never renders ${field}`).toContain(`job.${field}`)
    }
  })
})
