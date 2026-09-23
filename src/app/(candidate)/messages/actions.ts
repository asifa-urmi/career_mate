'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/guards'
import {
  markConversationRead,
  sendMessage,
  startConversation,
} from '@/server/services/message.service'
import { findConversation } from '@/lib/db/repositories/message.repository'
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

  const conversation = await findConversation(user.id, conversationId)
  if (!conversation) return { error: 'We could not find that conversation.' }

  // Opening it is reading it. Failing to mark it read would leave the badge on
  // forever and train people to ignore it.
  await markConversationRead(user, conversationId)
  revalidatePath('/', 'layout')

  return { conversation }
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
