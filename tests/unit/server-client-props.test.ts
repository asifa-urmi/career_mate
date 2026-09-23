import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(process.cwd(), 'src')

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, files)
    else if (entry.endsWith('.tsx')) files.push(full)
  }
  return files
}

const FILES = walk(SRC).map((path) => ({
  path,
  rel: relative(SRC, path).split(sep).join('/'),
  source: readFileSync(path, 'utf8'),
}))

const isClient = (source: string) => /^\s*['"]use client['"]/.test(source)

/** Every component exported from a file carrying the client directive. */
const CLIENT_COMPONENTS = new Set<string>()
for (const file of FILES) {
  if (!isClient(file.source)) continue
  for (const match of file.source.matchAll(/export (?:function|const) ([A-Z]\w*)/g)) {
    if (match[1]) CLIENT_COMPONENTS.add(match[1])
  }
}

/**
 * A server component cannot hand a function to a client component.
 *
 * React has to serialise the props that cross that boundary, and a function does
 * not serialise. The whole render fails — not the one component, the route — and
 * in production the reason is replaced by a digest, so the page returns 500 with
 * "Something went wrong" and nothing that names the cause.
 *
 * `/messages` shipped like this for a whole phase. The fix that caused it was
 * itself correct — the shared inbox needed each side to say where its own "View
 * role" link goes — but it said it with a function. A string the client
 * component builds the href from crosses the boundary; a function never can.
 *
 * Server actions are the exception and are allowed: `'use server'` is what makes
 * a function referenceable across the boundary. They are passed by name, so the
 * arrow-function form below is what this looks for.
 */
describe('the server/client props boundary', () => {
  it('finds the client components', () => {
    expect(CLIENT_COMPONENTS.size).toBeGreaterThan(10)
  })

  it('has no server component passing a function to a client component', () => {
    const offenders: string[] = []

    for (const file of FILES) {
      if (isClient(file.source)) continue

      for (const name of CLIENT_COMPONENTS) {
        // The whole JSX element, from its opening tag to the first `>` that
        // closes it, so a prop is only attributed to the element it is on.
        const element = new RegExp(`<${name}\\b[^>]*?/?>`, 'gs')

        for (const match of file.source.matchAll(element)) {
          const tag = match[0]
          const fnProp = /(\w+)=\{\s*(?:async\s*)?\(?[\w\s,{}]*\)?\s*=>/.exec(tag)

          if (fnProp) {
            offenders.push(`${file.rel}: <${name} ${fnProp[1]}={...} />`)
          }
        }
      }
    }

    expect(
      offenders,
      `functions crossing into a client component:\n${offenders.join('\n')}`,
    ).toEqual([])
  })
})
