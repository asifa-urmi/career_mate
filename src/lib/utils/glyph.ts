/** U+FE0E VARIATION SELECTOR-15: "render the preceding character as text". */
const TEXT_PRESENTATION = '︎'

/**
 * Forces a symbol to render as a monochrome glyph rather than a colour emoji.
 *
 * Several of the prototype's marks — ↗ U+2197, ☏ U+260F, ✚ U+271A, ✉ U+2709,
 * ⚙ U+2699 — have both a text and an emoji presentation, and Windows picks the
 * emoji one by default. That draws them as coloured pictograms at a weight that
 * fights the type, instead of the flat symbols the design uses.
 *
 * The selector is inert on characters that have no emoji presentation, so it is
 * safe to apply to every glyph rather than maintaining a list of exceptions.
 */
export function textGlyph(glyph: string): string {
  if (!glyph) return ''
  if (glyph.endsWith(TEXT_PRESENTATION)) return glyph
  return `${glyph}${TEXT_PRESENTATION}`
}
