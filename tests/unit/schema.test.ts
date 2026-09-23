import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const schema = readFileSync('prisma/schema.prisma', 'utf8')

describe('prisma schema', () => {
  it('keys User on the Supabase auth uid rather than generating one', () => {
    expect(schema).toMatch(/model User \{[\s\S]*?id\s+String\s+@id(?!\s*@default)/)
  })

  it('makes double-applying impossible at the database level', () => {
    expect(schema).toContain('@@unique([candidateProfileId, jobId])')
  })

  /**
   * Nothing may refuse a user deletion.
   *
   * Prisma emits ON DELETE RESTRICT for a required relation with no `onDelete`,
   * which is the default and is invisible in the schema. `Job.postedBy` was such
   * a relation, so any employer who had posted one job could never delete their
   * account: Postgres raised a foreign-key violation and the service reported it
   * as "please try again", forever. The settings panel promises the deletion is
   * possible, so the schema has to make it so.
   */
  it('lets a user be deleted no matter what they created', () => {
    const relations = schema
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /@relation\(.*references: \[id\]/.test(line) && /\bUser\??\s/.test(line))

    expect(relations.length, 'no relations to User found — has the schema moved?').toBeGreaterThan(
      5,
    )

    const blocking = relations.filter((line) => !/onDelete:\s*(Cascade|SetNull)/.test(line))

    expect(blocking, `relations to User that refuse a deletion: ${blocking.join(' | ')}`).toEqual([])
  })

  /**
   * Every scalar list defaults to empty.
   *
   * Prisma types a scalar list as OPTIONAL on create, but Postgres makes the
   * column NOT NULL with no default — so omitting one typechecks cleanly and
   * then fails at runtime with a null constraint violation. The seed omitted
   * `Job.screeningQuestions` and `tsc --noEmit` had nothing to say about it;
   * the first thing that noticed was Postgres, on a real database.
   *
   * An empty list is also the honest default: a job that asks no screening
   * questions asks none, it does not have an unknown number of them.
   */
  it('defaults every scalar list to empty, since the typechecker cannot', () => {
    // A list of a MODEL is a relation, stored on the other side, and needs no
    // default. A list of a scalar or an ENUM is a column on this table, and does.
    const enums = [...schema.matchAll(/enum (\w+) \{/g)].map((m) => m[1])
    const scalarTypes = new Set([
      'String',
      'Int',
      'Float',
      'Boolean',
      'DateTime',
      'Json',
      'Bytes',
      'Decimal',
      'BigInt',
      ...enums,
    ])

    const columnLists = schema
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => {
        const match = /^(\w+)\s+(\w+)\[\]/.exec(line)
        return match ? scalarTypes.has(match[2] ?? '') : false
      })

    // Relation lists dominate this schema, so zero matches would mean the filter
    // broke rather than that every list is defaulted.
    expect(columnLists.length, 'no scalar lists matched — has the schema moved?').toBeGreaterThan(3)

    const undefaulted = columnLists.filter((line) => !/@default\(\[/.test(line))

    expect(
      undefaulted,
      `scalar lists a create can omit and Postgres will then reject: ${undefaulted.join(' | ')}`,
    ).toEqual([])
  })

  it('configures a direct url so migrations bypass the pooler', () => {
    expect(schema).toContain('directUrl = env("DIRECT_URL")')
  })

  it('declares every enum later phases depend on', () => {
    for (const e of [
      'Role',
      'JobCategory',
      'ExperienceLevel',
      'WorkMode',
      'JobType',
      'JobStatus',
      'ModerationStatus',
      'ApplicationStage',
      'NotificationType',
      'ReportTargetType',
      'ReportStatus',
    ]) {
      expect(schema).toContain(`enum ${e} {`)
    }
  })
})
