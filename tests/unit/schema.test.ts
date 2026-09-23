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
