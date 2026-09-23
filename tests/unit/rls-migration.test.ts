import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const MIGRATIONS = join(process.cwd(), 'prisma', 'migrations')

function migrationSql(prefix: string): string {
  const dir = readdirSync(MIGRATIONS).find((d) => d.includes(prefix))
  if (!dir) throw new Error(`No migration directory matching "${prefix}"`)
  return readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8')
}

const init = migrationSql('init')
const rls = migrationSql('rls')

const TABLES = [...init.matchAll(/CREATE TABLE (?:"public"\.)?"([^"]+)"/g)].map((m) => m[1]!)

describe('init migration', () => {
  it('is committed, so production schema is reviewed rather than generated on a laptop', () => {
    expect(TABLES.length).toBeGreaterThan(0)
  })

  it('creates a table for every model', () => {
    expect(TABLES).toContain('User')
    expect(TABLES).toContain('Job')
    expect(TABLES).toContain('Application')
    expect(TABLES.length).toBe(21)
  })

  it('indexes the predicate every public listing actually uses', () => {
    expect(init).toMatch(/CREATE INDEX .*ON "Job"\("status", "moderation", "publishedAt"\)/)
  })
})

describe('deny-all RLS migration', () => {
  // Supabase grants public-schema tables to anon by default and the anon key
  // ships in the browser bundle. A table this migration forgets is readable —
  // and for User, writable — by anyone with the public key.
  it('locks down every table the init migration creates', () => {
    const unprotected = TABLES.filter(
      (t) =>
        !rls.includes(`ALTER TABLE "public"."${t}" ENABLE ROW LEVEL SECURITY`) ||
        !rls.includes(`REVOKE ALL ON TABLE "public"."${t}" FROM anon, authenticated`),
    )

    expect(
      unprotected,
      `tables reachable through the public API:\n${unprotected.join('\n')}`,
    ).toEqual([])
  })

  it('forces RLS so it binds even for the table owner', () => {
    for (const table of TABLES) {
      expect(rls).toContain(`ALTER TABLE "public"."${table}" FORCE ROW LEVEL SECURITY`)
    }
  })

  it('revokes default privileges so a later migration cannot silently reopen the API', () => {
    expect(rls).toMatch(/ALTER DEFAULT PRIVILEGES IN SCHEMA "public" REVOKE ALL ON TABLES/)
  })

  it('creates no permissive policy — opening a table up must be deliberate', () => {
    expect(rls).not.toMatch(/CREATE POLICY/i)
  })
})
