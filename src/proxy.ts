import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { decideRoute } from '@/lib/auth/route-decision'
import { misroutedCodeRedirect } from '@/lib/auth/email-callback'

/**
 * Runs before every matched request (Next 16 renamed this file convention from
 * "middleware" to "proxy"). Two jobs, both cheap:
 *
 *  1. Refresh the Supabase session on every request, so a long-lived tab does
 *     not silently expire.
 *  2. Turn anonymous visitors away from protected routes before any page work
 *     starts.
 *
 * Role and onboarding enforcement deliberately does NOT happen here. It needs the
 * user's row from Postgres, and every protected layout has to load that row
 * anyway — doing it in middleware would run the same query twice per request, and
 * would drag Prisma into the Edge runtime where it does not run. The layouts call
 * decideGroupAccess with the role they already have.
 */
export async function proxy(request: NextRequest) {
  // A confirmation code that arrived at the wrong path, handled before anything
  // else. Supabase falls back to the project's Site URL whenever the redirect it
  // was given is missing from the allow-list, and that fallback is the site root
  // — where the landing page renders and drops the code on the floor.
  const misrouted = misroutedCodeRedirect(
    request.nextUrl.pathname,
    request.nextUrl.searchParams,
  )
  if (misrouted) {
    return NextResponse.redirect(new URL(misrouted, request.nextUrl.origin))
  }

  const { response, userId } = await updateSession(request)

  if (!userId) {
    const decision = decideRoute({
      pathname: request.nextUrl.pathname,
      role: null,
      onboarded: false,
    })

    if (decision.action === 'redirect') {
      const url = request.nextUrl.clone()
      url.pathname = decision.to
      url.search = ''
      const redirectResponse = NextResponse.redirect(url)
      // Carry the refreshed auth cookies onto the redirect, or the next request
      // starts from a stale session.
      for (const cookie of response.cookies.getAll()) {
        redirectResponse.cookies.set(cookie)
      }
      return redirectResponse
    }
  }

  return response
}

export const config = {
  matcher: [
    // Everything except Next's internals and static assets. Without this every
    // image and font would pay for a session refresh.
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf|txt|xml)$).*)',
  ],
}
