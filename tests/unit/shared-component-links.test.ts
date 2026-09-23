import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { canAccess, routeGroupFor } from '@/lib/auth/roles'

/**
 * A component rendered for more than one role cannot hardcode a destination.
 *
 * The inbox is shared by both sides and linked "View role" to `/jobs/[id]`,
 * which belongs to the candidate group. Every employer who clicked it was
 * redirected to their dashboard with no explanation — the link was not broken,
 * it was forbidden, which looks identical and reads as the app misbehaving.
 *
 * So the href arrives as a prop, and each page supplies one its own role can
 * actually reach. These assert the values the two pages pass.
 */
describe('the shared inbox links each side somewhere it can go', () => {
  function jobHrefIn(page: string): string {
    const source = readFileSync(join(process.cwd(), 'src', 'app', page), 'utf8')
    const match = /jobHrefFor=\{\(id\) => `([^`]+)`\}/.exec(source)

    expect(match, `${page} passes no jobHrefFor to Inbox`).not.toBeNull()
    return (match?.[1] ?? '').replace('${id}', 'some-job-id')
  }

  it('sends a candidate to a route candidates may enter', () => {
    const href = jobHrefIn('(candidate)/messages/page.tsx')

    expect(canAccess('CANDIDATE', routeGroupFor(href)), `${href} refuses a candidate`).toBe(true)
  })

  it('sends an employer to a route employers may enter', () => {
    const href = jobHrefIn('(employer)/employer/messages/page.tsx')

    expect(canAccess('EMPLOYER', routeGroupFor(href)), `${href} refuses an employer`).toBe(true)
  })

  // The two pages must not both pass the same one by copy-paste.
  it('gives the two sides different destinations', () => {
    expect(jobHrefIn('(candidate)/messages/page.tsx')).not.toBe(
      jobHrefIn('(employer)/employer/messages/page.tsx'),
    )
  })

  it('leaves no hardcoded job link inside the shared component', () => {
    const inbox = readFileSync(
      join(process.cwd(), 'src', 'components', 'messages', 'inbox.tsx'),
      'utf8',
    )

    expect(inbox).not.toMatch(/href=\{`\/jobs\//)
  })
})
