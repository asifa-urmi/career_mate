/**
 * Two-letter monogram for a company avatar.
 *
 * Never returns an empty string: the avatar is a coloured square with the
 * letters centred in it, and an empty monogram renders as a blank tile that
 * looks like a loading failure.
 */
export function companyInitials(name: string): string {
  const firstLetters = name
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .filter((char): char is string => char !== undefined && /[a-z0-9]/i.test(char))

  if (firstLetters.length >= 2) {
    return `${firstLetters[0]}${firstLetters[1]}`.toUpperCase()
  }

  const fallback = name.trim().replace(/[^a-z0-9]/gi, '').slice(0, 2)
  return fallback ? fallback.toUpperCase() : '??'
}
