import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MAX_RESUME_BYTES } from '@/config/constants'

/**
 * The size a CV upload may be is asserted in three places that must agree:
 * the number the UI shows, the check inside the server action, and Next's own
 * limit on a server action's request body.
 *
 * Next's default body limit is 1 MB. It rejects the request in the runtime
 * before the action's own check can run, so the action returns nothing a form
 * can render — the upload fails silently. A two-page PDF with a photo clears
 * 1 MB easily, so the default breaks the feature for ordinary CVs while the
 * box on screen says 10 MB.
 */
describe('the CV upload size limit', () => {
  const config = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8')

  it("raises Next's server action body limit to at least the size we accept", () => {
    const match = /bodySizeLimit:\s*'(\d+)mb'/.exec(config)

    expect(match, 'next.config.ts sets no serverActions.bodySizeLimit').not.toBeNull()

    const limitBytes = Number(match?.[1]) * 1024 * 1024
    expect(
      limitBytes,
      `Next accepts ${match?.[1]}mb but the action accepts ${MAX_RESUME_BYTES} bytes, so the ` +
        'difference fails in the runtime with no error the form can show',
    ).toBeGreaterThanOrEqual(MAX_RESUME_BYTES)
  })

  // The box shows whatever `maxBytes` it is handed, so the promise on screen is
  // only true if the CV page hands it the same constant the action checks.
  it('hands the upload box the constant the action enforces', () => {
    const manager = readFileSync(
      join(process.cwd(), 'src', 'components', 'resume', 'resume-manager.tsx'),
      'utf8',
    )

    expect(manager).toMatch(/maxBytes=\{MAX_RESUME_BYTES\}/)
  })
})
