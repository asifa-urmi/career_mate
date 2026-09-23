import { describe, expect, it } from 'vitest'
import { textGlyph } from '@/lib/utils/glyph'
import { CATEGORIES } from '@/config/categories'
import { navFor } from '@/config/nav'

const VS15 = '︎'

describe('textGlyph', () => {
  it('appends the text variation selector so the glyph is not drawn as a colour emoji', () => {
    expect(textGlyph('☏')).toBe(`☏${VS15}`)
  })

  it('does not append twice to a glyph that already carries one', () => {
    expect(textGlyph(`☏${VS15}`)).toBe(`☏${VS15}`)
  })

  it('leaves an empty string alone', () => {
    expect(textGlyph('')).toBe('')
  })

  it('handles a multi-character label without mangling it', () => {
    expect(textGlyph('AI')).toBe(`AI${VS15}`)
  })
})

describe('configured glyphs', () => {
  // The prototype's sector and nav marks are monochrome symbols sized to the
  // type. Several of them (U+2197, U+260F, U+271A, U+2709, U+2699) have an emoji
  // presentation that Windows picks by default, which renders them as coloured
  // pictograms at the wrong weight.
  const EMOJI_DEFAULTING = ['↗', '☏', '✚', '✉', '⚙']

  it('renders every category glyph in text presentation', () => {
    for (const c of CATEGORIES) {
      const rendered = textGlyph(c.glyph)
      if (EMOJI_DEFAULTING.some((g) => c.glyph.startsWith(g))) {
        expect(rendered, `${c.label} glyph must force text presentation`).toContain(VS15)
      }
    }
  })

  it('renders every nav glyph in text presentation', () => {
    for (const role of ['CANDIDATE', 'EMPLOYER', 'ADMIN'] as const) {
      for (const section of navFor(role)) {
        for (const item of section.items) {
          if (EMOJI_DEFAULTING.some((g) => item.glyph.startsWith(g))) {
            expect(textGlyph(item.glyph), `${item.label} glyph`).toContain(VS15)
          }
        }
      }
    }
  })
})
