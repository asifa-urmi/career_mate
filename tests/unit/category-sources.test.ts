import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CATEGORIES } from '@/config/categories'
import { JOB_CATEGORY_VALUES } from '@/lib/validation/onboarding.schema'

/**
 * The job categories exist in three places: the Prisma enum (the database's
 * truth), CATEGORIES (labels and glyphs for the UI) and the Zod enum (what a
 * form is allowed to submit). Nothing bound them together, so adding a category
 * to the schema left it silently unsubmittable — with a green suite.
 */
const schema = readFileSync('prisma/schema.prisma', 'utf8')

const prismaEnum = (
  schema.match(/enum JobCategory \{([^}]*)\}/)?.[1] ?? ''
)
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('//'))

describe('job category sources agree', () => {
  it('finds the Prisma enum', () => {
    expect(prismaEnum.length).toBeGreaterThan(0)
  })

  it('CATEGORIES covers exactly the Prisma enum', () => {
    expect([...CATEGORIES.map((c) => c.value)].sort()).toEqual([...prismaEnum].sort())
  })

  it('the Zod enum covers exactly the Prisma enum, so every category is submittable', () => {
    expect([...JOB_CATEGORY_VALUES].sort()).toEqual([...prismaEnum].sort())
  })

  it('the Zod enum is derived from CATEGORIES rather than hand-copied', () => {
    expect([...JOB_CATEGORY_VALUES]).toEqual(CATEGORIES.map((c) => c.value))
  })
})
