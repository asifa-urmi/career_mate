/**
 * Taka amounts in the prototype's compact style: `৳45k–65k`.
 *
 * An absent salary reads "Negotiable" rather than `৳0`, because a job with no
 * posted range is a real and common case in this market and rendering it as zero
 * would be a lie about the offer.
 */
export function formatTaka(
  min?: number | null,
  max?: number | null,
  note?: string | null,
): string {
  const suffix = note ? ` + ${note}` : ''

  if (min == null && max == null) return 'Negotiable'
  if (min == null) return `Up to ${thousands(max as number)}${suffix}`
  if (max == null) return `${thousands(min)}+${suffix}`
  if (min === max) return `${thousands(min)}${suffix}`

  // En dash, matching the prototype.
  return `${thousands(min)}–${strip(thousands(max))}${suffix}`
}

function thousands(amount: number): string {
  return `৳${strip(String(round1(amount / 1000)))}k`
}

/** Drops the leading ৳ from the upper bound so a range reads `৳45k–65k`. */
function strip(value: string): string {
  return value.replace(/^৳/, '')
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * "2h ago", "3d ago", "3w ago". Anything under an hour — and anything in the
 * future, which a clock skew between server and database can produce — reads
 * "Today" rather than "in 4 minutes" or "-1h ago".
 */
export function relativeTime(date: Date, now: Date = new Date()): string {
  const ms = now.getTime() - date.getTime()
  if (ms < 60 * 60 * 1000) return 'Today'

  const hours = Math.floor(ms / (60 * 60 * 1000))
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 14) return `${days}d ago`

  const weeks = Math.floor(days / 7)
  if (weeks < 9) return `${weeks}w ago`

  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Monogram for an avatar. At most two letters, upper-cased. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * Scores drive a `conic-gradient` stop, so a NaN or an out-of-range value would
 * emit CSS the browser silently discards — leaving an empty ring with no clue
 * why. Everything is forced into 0–100 here instead.
 */
export function clampScore(score: number): number {
  if (Number.isNaN(score)) return 0
  return Math.min(100, Math.max(0, Math.round(score)))
}

/** `12` -> `12`, `1200` -> `1.2k`. For applicant counts and similar. */
export function compactCount(value: number): string {
  if (value < 1000) return String(value)
  return `${round1(value / 1000)}k`
}
