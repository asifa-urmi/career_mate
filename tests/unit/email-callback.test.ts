import { describe, expect, it } from 'vitest'
import {
  AUTH_CALLBACK_PATH,
  destinationAfterConfirm,
  emailRedirectTo,
  loginNoticeFor,
  misroutedCodeRedirect,
} from '@/lib/auth/email-callback'

/**
 * Clicking the link in a confirmation email has to end in a signed-in session.
 *
 * Supabase sends a one-time `code`, which is worth nothing until something
 * exchanges it. Nothing did: there was no callback route and no
 * `emailRedirectTo`, so the link landed on the Site URL root — in a fresh
 * project, `http://localhost:3000/?code=...` — where the landing page rendered
 * and ignored it. Every account created with Supabase's default settings, which
 * have email confirmation on, was stuck at that point with no way forward.
 */
describe('emailRedirectTo', () => {
  it('points at the callback route, not the site root', () => {
    expect(emailRedirectTo('https://career-mate.vercel.app')).toBe(
      `https://career-mate.vercel.app${AUTH_CALLBACK_PATH}`,
    )
  })

  it('works for localhost during development', () => {
    expect(emailRedirectTo('http://localhost:3000')).toBe(
      `http://localhost:3000${AUTH_CALLBACK_PATH}`,
    )
  })

  // Otherwise the URL ends up with a double slash, which Supabase's redirect
  // allow-list compares literally and rejects.
  it('does not double the slash when the origin carries one', () => {
    expect(emailRedirectTo('https://example.com/')).toBe(`https://example.com${AUTH_CALLBACK_PATH}`)
  })
})

describe('destinationAfterConfirm', () => {
  it('sends a confirmed candidate to finish their profile', () => {
    expect(destinationAfterConfirm({ role: 'CANDIDATE', onboarded: false })).toBe('/onboarding')
  })

  it('sends a confirmed employer to set up their company', () => {
    expect(destinationAfterConfirm({ role: 'EMPLOYER', onboarded: false })).toBe('/company-setup')
  })

  // Confirming a second time, or on another device, must not push a working
  // account back through setup it has already finished.
  it('sends an already-onboarded account to its own workspace', () => {
    expect(destinationAfterConfirm({ role: 'CANDIDATE', onboarded: true })).toBe('/dashboard')
    expect(destinationAfterConfirm({ role: 'EMPLOYER', onboarded: true })).toBe('/employer')
    expect(destinationAfterConfirm({ role: 'ADMIN', onboarded: true })).toBe('/admin')
  })

  // The code exchanged but no row was found — signup was interrupted between
  // creating the auth user and writing the profile.
  it('sends an unresolvable session to login rather than into a workspace', () => {
    expect(destinationAfterConfirm(null)).toBe('/login')
  })
})

/**
 * A code can arrive at the wrong path, and still has to work.
 *
 * Supabase falls back to the project's Site URL whenever `emailRedirectTo` is
 * absent or is not in the redirect allow-list — so a half-configured dashboard
 * sends the link to `/` with the code attached. Rather than let that be a dead
 * end, it is forwarded to the route that knows what to do with it.
 */
describe('misroutedCodeRedirect', () => {
  it('forwards a code that landed on the site root', () => {
    expect(misroutedCodeRedirect('/', new URLSearchParams('code=abc-123'))).toBe(
      `${AUTH_CALLBACK_PATH}?code=abc-123`,
    )
  })

  it('forwards a code that landed on any other page', () => {
    expect(misroutedCodeRedirect('/jobs-public', new URLSearchParams('code=abc-123'))).toBe(
      `${AUTH_CALLBACK_PATH}?code=abc-123`,
    )
  })

  // Or it would forward the code to itself, forever.
  it('leaves the callback route alone', () => {
    expect(misroutedCodeRedirect(AUTH_CALLBACK_PATH, new URLSearchParams('code=abc-123'))).toBeNull()
  })

  it('ignores a request with no code', () => {
    expect(misroutedCodeRedirect('/', new URLSearchParams())).toBeNull()
    expect(misroutedCodeRedirect('/jobs', new URLSearchParams('q=accounts'))).toBeNull()
  })

  // Supabase reports a dead link this way instead of sending a code.
  it('forwards an error the same way, so the person is told rather than ignored', () => {
    const params = new URLSearchParams('error=access_denied&error_code=otp_expired')

    expect(misroutedCodeRedirect('/', params)).toBe(
      `${AUTH_CALLBACK_PATH}?error=access_denied&error_code=otp_expired`,
    )
  })

  it('drops everything except the parameters the callback reads', () => {
    const params = new URLSearchParams('code=abc-123&utm_source=email&next=/admin')

    expect(misroutedCodeRedirect('/', params)).toBe(`${AUTH_CALLBACK_PATH}?code=abc-123`)
  })
})

/**
 * A link that did not work has to say so.
 *
 * The callback redirects to the login page when a code is dead or cannot be
 * exchanged. Carrying a reason as a short code, rather than a URL-encoded
 * sentence, keeps the wording in one place and keeps arbitrary text from a
 * crafted URL out of the page.
 */
describe('loginNoticeFor', () => {
  it('explains an expired or already-used link', () => {
    const notice = loginNoticeFor('expired_link')

    expect(notice).toMatch(/expired|already been used/i)
    expect(notice).toMatch(/sign up again|new one/i)
  })

  it('explains a code that could not be exchanged', () => {
    expect(loginNoticeFor('exchange_failed')).toMatch(/could not/i)
  })

  it('says nothing when there is nothing to say', () => {
    expect(loginNoticeFor(null)).toBeNull()
    expect(loginNoticeFor('')).toBeNull()
  })

  // Otherwise ?notice=<anything> paints attacker-chosen text onto the sign-in
  // page, which is where a convincing phishing line would do the most damage.
  it('ignores a code it does not know, rather than echoing it', () => {
    expect(loginNoticeFor('Your account was hacked, call 555-0100')).toBeNull()
    expect(loginNoticeFor('<script>alert(1)</script>')).toBeNull()
  })
})
