import type { JobCategory } from '@prisma/client'

/**
 * The job sectors, in the prototype's order, with its glyphs. The glyphs are
 * plain Unicode on purpose — the prototype used no icon font and the design
 * depends on their weight matching the type.
 */
export const CATEGORIES = [
  { value: 'TECHNOLOGY', label: 'Technology', glyph: '⌘' },
  { value: 'MARKETING', label: 'Marketing', glyph: '◎' },
  { value: 'SALES', label: 'Sales', glyph: '↗' },
  { value: 'FINANCE', label: 'Finance', glyph: '৳' },
  { value: 'HR', label: 'HR', glyph: '◉' },
  { value: 'DESIGN', label: 'Design', glyph: '✦' },
  { value: 'OPERATIONS', label: 'Operations', glyph: '▦' },
  { value: 'CUSTOMER_SUPPORT', label: 'Customer Support', glyph: '☏' },
  { value: 'HEALTHCARE', label: 'Healthcare', glyph: '✚' },
  { value: 'EDUCATION', label: 'Education', glyph: '▤' },
  { value: 'OTHER', label: 'Other', glyph: '＋' },
] as const satisfies readonly { value: JobCategory; label: string; glyph: string }[]

const BY_VALUE = new Map(CATEGORIES.map((c) => [c.value, c]))

export function categoryLabel(value: JobCategory): string {
  return BY_VALUE.get(value)?.label ?? 'Other'
}

export function categoryGlyph(value: JobCategory): string {
  return BY_VALUE.get(value)?.glyph ?? '＋'
}
