/**
 * Whether a form actually carried a file.
 *
 * An untouched file input still submits an entry: a `File` with an empty name
 * and zero bytes. So "was anything attached?" is a different question from "is
 * the field present?", and getting it wrong means either dropping a CV somebody
 * chose or trying to upload nothing every time somebody skips the step.
 *
 * A server action's FormData is attacker-controlled like any request body, so a
 * plain string where a file belongs has to be refused rather than trusted into
 * whatever reads `.name` next.
 */
export function attachedResume(entry: unknown): File | null {
  if (!(entry instanceof File)) return null
  if (!entry.name || entry.size === 0) return null
  return entry
}
