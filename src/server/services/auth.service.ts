'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createServerSupabase } from '@/lib/supabase/server'

/**
 * Signs out and clears the cached render tree.
 *
 * Without the revalidate, a signed-out user navigating back would be served the
 * previous user's cached page — the session is gone but the HTML is not.
 */
export async function signOutAction(): Promise<void> {
  const supabase = await createServerSupabase()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}
