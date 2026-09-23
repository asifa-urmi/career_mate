import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(process.cwd(), 'src')

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      walk(full, files)
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      files.push(full)
    }
  }
  return files
}

const FILES = walk(SRC).map((path) => ({
  path,
  rel: relative(SRC, path).split(sep).join('/'),
  source: readFileSync(path, 'utf8'),
}))

/** Files carrying the `use client` directive, which ship to the browser. */
const CLIENT_FILES = FILES.filter((f) => /^\s*['"]use client['"]/.test(f.source))

/** Every module specifier a file imports, `import` and `export ... from` alike. */
function importsOf(source: string): string[] {
  const specifiers: string[] = []
  const pattern = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]/g

  for (const match of source.matchAll(pattern)) {
    if (match[1]) specifiers.push(match[1])
  }

  return specifiers
}

describe('the client/server boundary', () => {
  it('finds the client components', () => {
    expect(CLIENT_FILES.length).toBeGreaterThan(10)
  })

  /**
   * A `use client` file is bundled for the browser. Importing a service from one
   * drags that service — and its Prisma client, its Supabase server client and
   * its `server-only` marker — into the browser graph, which fails the build.
   * The build catches it; this catches it one command earlier, and names the
   * offender instead of printing an import trace.
   *
   * A value both sides need belongs in `src/lib`, imported by each.
   */
  it('has no client component importing from src/server', () => {
    const offenders: string[] = []

    for (const file of CLIENT_FILES) {
      for (const specifier of importsOf(file.source)) {
        if (specifier.startsWith('@/server/') || specifier.includes('/src/server/')) {
          offenders.push(`${file.rel} imports ${specifier}`)
        }
      }
    }

    expect(offenders, `client components reaching into src/server: ${offenders.join(', ')}`).toEqual(
      [],
    )
  })

  // `server-only` throws at build time in a browser bundle, which is the point.
  // A service without it is one careless import away from shipping Prisma to the
  // browser and finding out from a stack trace instead of a build failure.
  it('marks every service as server-only', () => {
    const services = FILES.filter((f) => f.rel.startsWith('server/services/'))
    expect(services.length).toBeGreaterThan(5)

    const unmarked = services
      .filter((f) => !f.source.includes("import 'server-only'"))
      .map((f) => f.rel)

    expect(unmarked, `services missing the server-only marker: ${unmarked.join(', ')}`).toEqual([])
  })
})
