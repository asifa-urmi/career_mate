import { describe, expect, it } from 'vitest'
import { CATEGORIES, categoryGlyph, categoryLabel } from '@/config/categories'
import { APPLICATION_STAGES, STAGE_TONE } from '@/config/constants'
import { navFor } from '@/config/nav'
import { canAccess, routeGroupFor } from '@/lib/auth/roles'

describe('categories', () => {
  it('covers every JobCategory enum value exactly once', () => {
    const values = CATEGORIES.map((c) => c.value)
    expect(new Set(values).size).toBe(values.length)
    expect(values).toHaveLength(11)
  })

  it('keeps the prototype labels and glyphs', () => {
    expect(categoryLabel('CUSTOMER_SUPPORT')).toBe('Customer Support')
    expect(categoryLabel('HR')).toBe('HR')
    expect(categoryGlyph('FINANCE')).toBe('৳')
    expect(categoryGlyph('TECHNOLOGY')).toBe('⌘')
  })
})

describe('STAGE_TONE', () => {
  it('gives every application stage a chip tone', () => {
    for (const stage of APPLICATION_STAGES) {
      expect(STAGE_TONE[stage.value]).toBeDefined()
    }
  })

  it('covers all seven stages', () => {
    expect(APPLICATION_STAGES).toHaveLength(7)
  })
})

describe('navFor', () => {
  it('gives each role a distinct, non-empty navigation', () => {
    for (const role of ['CANDIDATE', 'EMPLOYER', 'ADMIN'] as const) {
      const sections = navFor(role)
      expect(sections.length).toBeGreaterThan(0)
      expect(sections.flatMap((s) => s.items).length).toBeGreaterThan(0)
    }
  })

  it('never offers a candidate an employer destination', () => {
    const hrefs = navFor('CANDIDATE').flatMap((s) => s.items.map((i) => i.href))
    expect(hrefs).not.toContain('/post-job')
    expect(hrefs).not.toContain('/employer')
  })

  it('only offers each role destinations its own guard will admit', () => {
    for (const role of ['CANDIDATE', 'EMPLOYER', 'ADMIN'] as const) {
      for (const section of navFor(role)) {
        for (const item of section.items) {
          const group = routeGroupFor(item.href)
          expect(
            canAccess(role, group),
            `${role} nav offers ${item.href} (group "${group}") but canAccess refuses it`,
          ).toBe(true)
        }
      }
    }
  })

  it('has no duplicate destination within a role', () => {
    for (const role of ['CANDIDATE', 'EMPLOYER', 'ADMIN'] as const) {
      const hrefs = navFor(role).flatMap((s) => s.items.map((i) => i.href))
      expect(new Set(hrefs).size).toBe(hrefs.length)
    }
  })
})
