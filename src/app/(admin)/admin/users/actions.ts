'use server'

import { revalidatePath } from 'next/cache'
import type { Role } from '@prisma/client'
import { requireUser } from '@/lib/auth/guards'
import { changeUserRole, setUserSuspended } from '@/server/services/admin.service'

export async function changeRoleAction(
  userId: string,
  role: Role,
): Promise<{ error?: string }> {
  const admin = await requireUser()
  const result = await changeUserRole(admin, userId, role)
  if (!result.ok) return { error: result.error.message }

  revalidatePath('/admin/users')
  revalidatePath('/admin')
  return {}
}

export async function setSuspendedAction(
  userId: string,
  suspended: boolean,
  reason?: string,
): Promise<{ error?: string }> {
  const admin = await requireUser()
  const result = await setUserSuspended(admin, userId, suspended, reason)
  if (!result.ok) return { error: result.error.message }

  revalidatePath('/admin/users')
  revalidatePath('/admin')
  return {}
}
