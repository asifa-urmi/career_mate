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

/** The JSX element a position in the source sits inside, by its opening tag. */
function enclosingComponent(source: string, index: number): string | null {
  const before = source.slice(0, index)
  const opens = [...before.matchAll(/<([A-Z]\w*)/g)]
  return opens.length ? (opens[opens.length - 1]?.[1] ?? null) : null
}

/**
 * A server component cannot hand a function to a client component.
 *
 * React serialises the props that cross that boundary, and a function does not
 * serialise. The whole render fails — not the one component, the route — and in
 * production the reason is replaced by a digest, so the page returns 500 with
 * "Something went wrong" and a number that means nothing without the server log.
 *
 * Both shapes below shipped at once and took a page down each. Neither the build
 * nor the typechecker sees them, and a test that renders the component in plain
 * React does not either, because plain React accepts a function prop happily.
 * Only the server boundary rejects it.
 *
 * Server actions are the exception: `'use server'` is what makes a function
 * referenceable across the boundary, and they are passed by name rather than as
 * a literal, so neither check below touches them.
 */
describe('the server/client props boundary', () => {
  it('finds the client components', () => {
    expect(CLIENT_COMPONENTS.size).toBeGreaterThan(10)
  })

  // `jobHrefFor={(id) => `/jobs/${id}`}` — the one that broke /messages.
  it('has no server component passing a function as an attribute', () => {
    const offenders: string[] = []

    for (const file of FILES) {
      if (isClient(file.source)) continue

      for (const match of file.source.matchAll(/(\w+)=\{\s*(?:async\s*)?\([\w\s,{}]*\)\s*=>/g)) {
        const owner = enclosingComponent(file.source, match.index)
        if (owner && CLIENT_COMPONENTS.has(owner)) {
          offenders.push(`${file.rel}: <${owner} ${match[1]}={...} />`)
        }
      }
    }

    expect(
      offenders,
      `functions crossing into a client component: ${offenders.join(', ')}`,
    ).toEqual([])
  })

  /**
   * `children` is a prop like any other and crosses the same boundary.
   *
   * A render prop — `<Section>{(state, values) => ...}</Section>` — is a
   * function passed as `children`, so it fails exactly as an attribute would. It
   * looks nothing like one in the source, which is why it outlived the first
   * version of this test and took `/profile` down on its own.
   */
  it('has no server component passing a function as children', () => {
    const offenders: string[] = []

    for (const file of FILES) {
      if (isClient(file.source)) continue

      // A render prop is the first thing inside an element: a newline, then
      // `{(` — as opposed to an attribute, which sits before the closing `>`.
      for (const match of file.source.matchAll(/\n\s*\{\s*\([\w\s,{}]*\)\s*=>/g)) {
        const owner = enclosingComponent(file.source, match.index)
        if (owner && CLIENT_COMPONENTS.has(owner)) {
          offenders.push(`${file.rel}: <${owner}>{(...) => ...}</${owner}>`)
        }
      }
    }

    expect(
      offenders,
      `render props crossing into a client component: ${offenders.join(', ')}`,
    ).toEqual([])
  })
})
