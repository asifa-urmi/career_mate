'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/guards'
import {
  openConversation,
  sendMessage,
  startConversation,
} from '@/server/services/message.service'
import type { ConversationDetail } from '@/lib/db/repositories/message.repository'

/**
 * Membership is enforced by the repository query and the service, both with the
 * predicate in the `where`. These actions pass the session user through — a
 * server action is a public endpoint and runs no layout guard.
 */
export async function openConversationAction(
  conversationId: string,
): Promise<{ conversation?: ConversationDetail; error?: string }> {
  const user = await requireUser()

  const result = await openConversation(user, conversationId)
  if (!result.ok) return { error: result.error.message }

  // The two inboxes, not the whole shell. Opening a thread clears its unread
  // mark in the list beside it; nothing outside these pages shows unread state,
  // so revalidating the layout was work nobody could see.
  revalidatePath('/messages')
  revalidatePath('/employer/messages')

  return { conversation: result.value }
}

export async function sendMessageAction(
  conversationId: string,
  body: string,
): Promise<{ error?: string }> {
  const user = await requireUser()

  const result = await sendMessage(user, conversationId, body)
  if (!result.ok) return { error: result.error.message }

  revalidatePath('/messages')
  revalidatePath('/employer/messages')
  return {}
}

export async function startConversationAction(
  applicationId: string,
): Promise<{ conversationId?: string; error?: string }> {
  const user = await requireUser()

  const result = await startConversation(user, applicationId)
  if (!result.ok) return { error: result.error.message }

  revalidatePath('/employer/messages')
  return { conversationId: result.value.conversationId }
}
