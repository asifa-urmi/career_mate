/**
 * Short-term memory of which providers are out of credit.
 *
 * Without it, an exhausted free tier is retried on every single request and adds
 * its round trip — or worse, its timeout — to all of them. A provider that says
 * "rate limited" or "out of quota" is saying something about the next few
 * minutes, not about this one request, so it is skipped for a while.
 *
 * In-memory on purpose. It is a latency optimisation, not correctness: a cold
 * serverless instance simply tries that provider once and learns again. Putting
 * it in the database would make every AI request pay a write to save a call that
 * was going to fail cheaply anyway.
 */

const unavailableUntil = new Map<string, number>()

/** A rate limit usually clears in a minute; an exhausted daily quota does not. */
export const COOLDOWN_MS = {
  rate_limited: 60_000,
  quota: 15 * 60_000,
} as const

export function markUnavailable(providerId: string, forMs: number, now = Date.now()): void {
  unavailableUntil.set(providerId, now + forMs)
}

export function isAvailable(providerId: string, now = Date.now()): boolean {
  const until = unavailableUntil.get(providerId)
  if (until === undefined) return true
  if (until <= now) {
    unavailableUntil.delete(providerId)
    return true
  }
  return false
}

export function clearCooldowns(): void {
  unavailableUntil.clear()
}
