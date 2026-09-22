import type { Role } from '@prisma/client'
import { createServerSupabase } from '@/lib/supabase/server'
import { findUserById } from '@/lib/db/repositories/user.repository'

export type SessionUser = {
  id: string
  email: string
  name: string
  role: Role
  onboardedAt: Date | null
}

/**
 * Resolves the caller, or null.
 *
 * A Supabase session with no matching User row means signup was interrupted
 * between creating the auth user and writing the profile. That is treated as
 * unauthenticated rather than as a user with no role: every protected page reads
 * `role`, so handing back a half-built user would crash all of them.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null

  const user = await findUserById(data.user.id)
  return user ?? null
}
