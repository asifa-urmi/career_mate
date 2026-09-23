import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const MIGRATIONS = join(process.cwd(), 'prisma', 'migrations')

function migrationSql(prefix: string): string {
  const dir = readdirSync(MIGRATIONS).find((d) => d.includes(prefix))
  if (!dir) throw new Error(`No migration directory matching "${prefix}"`)
  return readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8')
}

/** Every migration's SQL, so a table added later cannot escape this check. */
function allMigrationSql(): string {
  return readdirSync(MIGRATIONS)
    .filter((d) => !d.endsWith('.toml'))
    .map((d) => {
      try {
        return readFileSync(join(MIGRATIONS, d, 'migration.sql'), 'utf8')
      } catch {
        return ''
      }
    })
    .join('\n')
}

const init = migrationSql('init')

/**
 * Also collected across ALL migrations.
 *
 * Reading only the deny-all migration would mean a table added later could only
 * be locked down by editing a migration that has already been applied — which
 * changes nothing in a database that ran it, and silently drifts the checksum.
 * A later migration carries its own deny-all block instead, and this still sees
 * it.
 */
const rls = allMigrationSql()

/**
 * Collected across ALL migrations, not just init.
 *
 * Reading only the first migration made this guard useless for its actual job:
 * a table created by any later migration was invisible to it, so forgetting the
 * deny-all block would leave the suite green while Supabase's default grants
 * exposed that table through PostgREST to the anon key in the browser bundle.
 */
const TABLES = [
  ...new Set(
    [...allMigrationSql().matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(?:"public"\.)?"([^"]+)"/g)].map(
      (m) => m[1]!,
    ),
  ),
]

describe('init migration', () => {
  it('is committed, so production schema is reviewed rather than generated on a laptop', () => {
    expect(TABLES.length).toBeGreaterThan(0)
  })

  it('creates a table for every model', () => {
    expect(TABLES).toContain('User')
    expect(TABLES).toContain('Job')
    expect(TABLES).toContain('Application')
    // No frozen count: a hardcoded number cannot fail when a table is added.
    expect(TABLES.length).toBeGreaterThanOrEqual(21)
  })

  it('indexes the predicate every public listing actually uses', () => {
    expect(init).toMatch(/CREATE INDEX .*ON "Job"\("status", "moderation", "publishedAt"\)/)
  })
})

describe('deny-all RLS migration', () => {
  // Supabase grants public-schema tables to anon by default and the anon key
  // ships in the browser bundle. A table this migration forgets is readable —
  // and for User, writable — by anyone with the public key.
  it('locks down every table any migration creates', () => {
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

  /**
   * `anon` and `authenticated` are Supabase's roles, not Postgres's.
   *
   * The REVOKE statements name them directly, and Postgres refuses to revoke
   * from a role that does not exist — so on a plain Postgres, which is what a
   * local machine and a CI runner have, this migration aborted with `role
   * "anon" does not exist` and the whole deploy stopped at migration two. The
   * app could not be run anywhere except against Supabase.
   *
   * Creating them when missing costs nothing on Supabase, where they already
   * exist, and makes the same committed SQL apply everywhere.
   */
  it('does not assume Supabase-only roles already exist', () => {
    for (const role of ['anon', 'authenticated']) {
      expect(
        rls,
        `the migration revokes from "${role}" without ensuring it exists`,
      ).toMatch(new RegExp(`CREATE ROLE ${role}`, 'i'))
    }

    // Guarded, or re-running it on Supabase would fail on the existing role.
    expect(rls).toMatch(/pg_roles/i)
  })
})

describe('search index migration', () => {
  const search = migrationSql('search_indexes')

  // ILIKE '%term%' cannot use a btree index, so without these every search is a
  // sequential scan. Imperceptible at twelve rows, unusable at fifty thousand.
  it('indexes the three columns the text search actually scans', () => {
    expect(search).toMatch(/GIN \("title" gin_trgm_ops\)/)
    expect(search).toMatch(/GIN \("summary" gin_trgm_ops\)/)
    expect(search).toMatch(/GIN \("name" gin_trgm_ops\)/)
  })

  it('indexes both skill arrays, which hasSome queries', () => {
    expect(search).toMatch(/GIN \("requiredSkills"\)/)
    expect(search).toMatch(/GIN \("preferredSkills"\)/)
  })

  it('enables pg_trgm idempotently, since the extension may already exist', () => {
    expect(search).toContain('CREATE EXTENSION IF NOT EXISTS pg_trgm')
  })
})
