import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/session'
import { destinationAfterConfirm } from '@/lib/auth/email-callback'

/**
 * Where every link in a Supabase email lands.
 *
 * Supabase does not sign anyone in by sending an email. It sends a one-time
 * `code`, and this is what exchanges it for a session cookie. Without this
 * route, clicking "confirm your email" put the code in the address bar of the
 * landing page, which ignored it — so the account was confirmed at the provider
 * and the person was still signed out, with nothing on screen to act on.
 *
 * Kept outside the (auth) route group on purpose: that group's layout runs the
 * auth-page guard, which redirects a signed-in visitor away — and by the time
 * this handler finishes exchanging, the visitor is signed in.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl

  // A dead or already-used link. Supabase reports it this way instead of
  // sending a code, and the person needs to be told rather than bounced to a
  // login form that cannot explain itself.
  const error = searchParams.get('error_description') ?? searchParams.get('error')
  if (error) {
    return NextResponse.redirect(`${origin}/login?notice=expired_link`)
  }

  const code = searchParams.get('code')
  if (!code) return NextResponse.redirect(`${origin}/login`)

  const supabase = await createServerSupabase()
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    return NextResponse.redirect(`${origin}/login?notice=exchange_failed`)
  }

  // Read back through the same path every guard uses, so a confirmed account
  // that is suspended, or has no profile row, is treated here exactly as it
  // would be anywhere else rather than by a second opinion written just for
  // this route.
  const user = await getCurrentUser()

  return NextResponse.redirect(`${origin}${destinationAfterConfirm(user)}`)
}
