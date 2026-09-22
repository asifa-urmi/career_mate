'use client'

import { createBrowserClient } from '@supabase/ssr'
import { publicEnv } from '@/lib/env'

let cached: ReturnType<typeof createBrowserClient> | null = null

/**
 * Browser Supabase client. Cached because each instance registers its own auth
 * state listener, and duplicates would fire redundant refreshes.
 */
export function createBrowserSupabase() {
  if (cached) return cached
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = publicEnv()
  cached = createBrowserClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
  return cached
}
