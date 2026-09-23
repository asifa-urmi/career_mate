import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { publicEnv, serverEnv } from '@/lib/env'

/**
 * Cookie-backed Supabase client for server components, server actions and route
 * handlers. It holds the *user's* session — every query through it is subject to
 * whatever that user is allowed to do.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies()
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = publicEnv()

  return createServerClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server components cannot set cookies. The middleware refreshes the
          // session on every request, so a failure here is expected and safe to
          // swallow — it is not a lost session.
        }
      },
    },
  })
}

/**
 * Service-role client. Bypasses Row Level Security, so it is only ever used for
 * operations the application has already authorized in a service — currently
 * signed-URL minting and storage writes. Never expose it to the browser.
 */
export function createAdminSupabase() {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = serverEnv()

  return createServerClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    cookies: {
      getAll() {
        return []
      },
      setAll() {
        // A service-role client has no session to persist.
      },
    },
  })
}
