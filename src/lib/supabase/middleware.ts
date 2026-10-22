import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { publicEnv } from '@/lib/env'

/**
 * Refreshes the Supabase session on every request and reports who the caller is.
 *
 * Returning the user id alongside the response lets middleware decide routing
 * without a second round trip. The response carries the refreshed auth cookies,
 * so it must be the one middleware ultimately returns (or the one whose cookies
 * are copied onto a redirect).
 */
export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse
  userId: string | null
}> {
  let response = NextResponse.next({ request })
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = publicEnv()

  const supabase = createServerClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // getUser() revalidates the token with Supabase. getSession() only reads the
  // cookie, which a client could have forged, so it must not be used for
  // anything that gates access.
  try {
    const timeout = new Promise<{ data: { user: null } }>((resolve) =>
      setTimeout(() => resolve({ data: { user: null } }), 4000),
    )
    const result = await Promise.race([
      supabase.auth.getUser().catch(() => ({ data: { user: null } })),
      timeout,
    ])
    return { response, userId: result.data.user?.id ?? null }
  } catch {
    return { response, userId: null }
  }
}
