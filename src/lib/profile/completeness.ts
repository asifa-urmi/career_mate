export type ProfileForCompleteness = {
  headline: string | null
  location: string | null
  bio: string | null
  preference: { targetRole: string | null; minSalaryBdt: number | null } | null
  counts: { experiences: number; educations: number; skills: number; resumes: number }
}

const filled = (value: string | null) => Boolean(value && value.trim())

/**
 * The eight signals that make up a complete profile, each with a label.
 *
 * They carry labels rather than being an anonymous boolean list so the UI can
 * tell someone *which* piece is missing. A bare percentage with no way to act on
 * it is a scold, not a prompt.
 */
export const PROFILE_SIGNALS: readonly {
  label: string
  href: string
  met: (p: ProfileForCompleteness) => boolean
}[] = [
  { label: 'Headline', href: '/profile', met: (p) => filled(p.headline) },
  { label: 'Location', href: '/profile', met: (p) => filled(p.location) },
  { label: 'About you', href: '/profile', met: (p) => filled(p.bio) },
  { label: 'Target role', href: '/settings', met: (p) => filled(p.preference?.targetRole ?? null) },
  { label: 'Work experience', href: '/profile', met: (p) => p.counts.experiences > 0 },
  { label: 'Education', href: '/profile', met: (p) => p.counts.educations > 0 },
  { label: 'Skills', href: '/profile', met: (p) => p.counts.skills > 0 },
  { label: 'A CV', href: '/resume', met: (p) => p.counts.resumes > 0 },
]

/** 0–100, every signal weighted equally. */
export function profileCompleteness(profile: ProfileForCompleteness): number {
  const met = PROFILE_SIGNALS.filter((signal) => signal.met(profile)).length
  return Math.round((met / PROFILE_SIGNALS.length) * 100)
}

export function missingProfileSignals(profile: ProfileForCompleteness) {
  return PROFILE_SIGNALS.filter((signal) => !signal.met(profile))
}
