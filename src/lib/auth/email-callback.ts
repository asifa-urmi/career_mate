import type { Role } from '@prisma/client'
import { homePathFor } from '@/lib/auth/roles'
import { onboardingPathFor } from '@/lib/auth/guards'

/**
 * What happens after someone clicks a link in an email from Supabase.
 *
 * Supabase does not sign anybody in by sending that email. It sends a one-time
 * `code`, and the application has to exchange it for a session. Nothing did:
 * there was no callback route and no `emailRedirectTo`, so the link fell back to
 * the project's Site URL — `http://localhost:3000/?code=...` in a fresh project
 * — where the landing page rendered and ignored the parameter entirely. Every
 * account created under Supabase's default settings, which have email
 * confirmation switched on, stopped there with nothing to click and no error.
 *
 * The logic lives here, apart from the route that runs it, because a mistake in
 * it either strands a new account or hands a session to the wrong place.
 */

/** Where Supabase is told to send someone, and the only route that reads a code. */
export const AUTH_CALLBACK_PATH = '/auth/callback'

/**
 * The absolute URL for `emailRedirectTo`.
 *
 * Absolute because it goes into an email, and Supabase checks it against the
 * project's redirect allow-list — which compares literally, so a doubled slash
 * is rejected and the link silently falls back to the Site URL again.
 */
export function emailRedirectTo(origin: string): string {
  return `${origin.replace(/\/+$/, '')}${AUTH_CALLBACK_PATH}`
}

/**
 * Where a just-confirmed account goes.
 *
 * Confirming is not the end of signup — the profile still has to be filled in —
 * so a new account continues into onboarding. One that has already finished goes
 * to its workspace instead, because confirming again on a second device must not
 * push a working account back through setup.
 *
 * A null user means the code exchanged but no row was found: signup was
 * interrupted between creating the auth user and writing the profile. That is
 * not a session to act on, so it goes to login.
 */
export function destinationAfterConfirm(
  user: { role: Role; onboarded: boolean } | null,
): string {
  if (!user) return '/login'
  return user.onboarded ? homePathFor(user.role) : onboardingPathFor(user.role)
}

/** The only query parameters the callback acts on. */
const CALLBACK_PARAMS = ['code', 'error', 'error_code', 'error_description'] as const

/**
 * A code that arrived somewhere other than the callback, and where to send it.
 *
 * Supabase falls back to the Site URL whenever `emailRedirectTo` is missing or
 * is not on the redirect allow-list, so a half-configured dashboard delivers the
 * link to `/` with the code attached. Forwarding it costs one redirect and means
 * the flow works before the dashboard is perfect, rather than dead-ending on a
 * page that has no idea what the parameter is.
 *
 * Only the parameters the callback reads are carried over — an open redirect
 * would otherwise be one crafted `next=` away.
 */
export function misroutedCodeRedirect(
  pathname: string,
  params: URLSearchParams,
): string | null {
  if (pathname === AUTH_CALLBACK_PATH) return null

  const carried = new URLSearchParams()
  for (const key of CALLBACK_PARAMS) {
    const value = params.get(key)
    if (value) carried.set(key, value)
  }

  if (![...carried.keys()].length) return null

  return `${AUTH_CALLBACK_PATH}?${carried.toString()}`
}

/**
 * What the login page says after a link failed.
 *
 * Carried as a short code rather than a URL-encoded sentence, so the wording
 * lives in one place and an unrecognised value renders nothing. Echoing the
 * parameter would let a crafted link paint any text onto the sign-in page, which
 * is exactly where a convincing phishing line would do the most damage.
 */
const LOGIN_NOTICES: Record<string, string> = {
  expired_link:
    'That link has expired or has already been used. Sign in below, or sign up again to get a new one.',
  exchange_failed:
    'We could not complete that link. Sign in below, or sign up again to get a new one.',
}

export function loginNoticeFor(code: string | null | undefined): string | null {
  if (!code) return null
  return LOGIN_NOTICES[code] ?? null
}
