'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { NotificationType } from '@prisma/client'
import { requireUser } from '@/lib/auth/guards'
import {
  changeEmail,
  changePassword,
  deleteMyAccount,
  exportMyData,
  updateNotificationPreferences,
} from '@/server/services/account.service'

export type SettingsState = { error?: string; saved?: string }

/**
 * Every action here acts on the caller and takes no user id, so there is
 * nothing in the request to tamper with.
 */
export async function changeEmailAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireUser()
  const result = await changeEmail(user, String(formData.get('email') ?? ''))

  if (!result.ok) return { error: result.error.message }

  revalidatePath('/settings')
  return { saved: 'Check the new address for a confirmation link. Until you click it, sign in with your old one.' }
}

export async function changePasswordAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireUser()
  const result = await changePassword(
    user,
    String(formData.get('currentPassword') ?? ''),
    String(formData.get('newPassword') ?? ''),
  )

  if (!result.ok) return { error: result.error.message }
  return { saved: 'Password changed.' }
}

export async function saveNotificationsAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireUser()

  const types = formData.getAll('notifyOn').map(String) as NotificationType[]
  const result = await updateNotificationPreferences(user, types)

  if (!result.ok) return { error: result.error.message }

  revalidatePath('/settings')
  return { saved: 'Saved.' }
}

export async function exportDataAction(): Promise<{ json?: string; error?: string }> {
  const user = await requireUser()
  const result = await exportMyData(user)

  if (!result.ok) return { error: result.error.message }
  return { json: JSON.stringify(result.value, null, 2) }
}

export async function deleteAccountAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireUser()
  const result = await deleteMyAccount(user, String(formData.get('confirmation') ?? ''))

  if (!result.ok) return { error: result.error.message }

  revalidatePath('/', 'layout')
  redirect('/')
}
