'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/guards'
import { markAllNotificationsRead } from '@/lib/db/repositories/notification.repository'

/**
 * Scoped to the caller inside the repository's where clause, so this cannot be
 * used to clear someone else's inbox by id — there is no id to pass.
 */
export async function markAllReadAction(): Promise<void> {
  const user = await requireUser()
  await markAllNotificationsRead(user.id)
  revalidatePath('/notifications')
  revalidatePath('/', 'layout')
}
