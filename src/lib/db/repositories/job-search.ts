import type { Prisma } from '@prisma/client'

/**
 * The free-text search clause, extracted so it can be tested without a database.
 *
 * Skills are matched with a case-insensitive `hasSome` over the lower-cased
 * search term AND its title-cased form, rather than `has`. `has` is an exact,
 * case-sensitive array-element match, so a search for "react" never matched a
 * job whose requiredSkills held "React" — the search box promises "title,
 * company or skill" and the skill third of that was silently dead.
 */
export function buildSearchClause(raw: string): Prisma.JobWhereInput | undefined {
  const search = raw.trim()
  if (!search) return undefined

  return {
    OR: [
      { title: { contains: search, mode: 'insensitive' } },
      { summary: { contains: search, mode: 'insensitive' } },
      { company: { name: { contains: search, mode: 'insensitive' } } },
      { requiredSkills: { hasSome: skillVariants(search) } },
      { preferredSkills: { hasSome: skillVariants(search) } },
    ],
  }
}

/**
 * Postgres array containment has no case-insensitive form, so the realistic
 * casings are enumerated instead. Skills are short, human-entered labels —
 * "React", "REST API", "meta ads" — and these four cover how they are written
 * in practice without resorting to a sequential scan over every row.
 */
function skillVariants(search: string): string[] {
  const lower = search.toLowerCase()
  const upper = search.toUpperCase()
  const title = lower.replace(/(^|\s)(\S)/g, (_, space: string, c: string) => space + c.toUpperCase())

  return [...new Set([search, lower, upper, title])]
}
