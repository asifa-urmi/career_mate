import { prisma } from '@/lib/db/prisma'
import { relativeTime } from '@/lib/utils/format'

export type ConversationSummary = {
  id: string
  subject: string
  otherName: string
  lastMessage: string | null
  lastAtLabel: string
  unread: boolean
}

export type MessageModel = {
  id: string
  body: string
  mine: boolean
  atLabel: string
}

export type ConversationDetail = ConversationSummary & {
  messages: MessageModel[]
  applicationId: string | null
  jobId: string | null
}

/**
 * The caller's threads. Scoped by participation in the `where`, so there is no
 * list of conversations that belong to anyone else to filter down from.
 */
export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  const rows = await prisma.conversation.findMany({
    where: { participants: { some: { userId } } },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      subject: true,
      updatedAt: true,
      participants: {
        select: { userId: true, lastReadAt: true, user: { select: { name: true } } },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { body: true, createdAt: true, senderId: true },
      },
    },
  })

  const now = new Date()
  return rows.map((row) => {
    const me = row.participants.find((p) => p.userId === userId)
    const other = row.participants.find((p) => p.userId !== userId)
    const last = row.messages[0]

    return {
      id: row.id,
      subject: row.subject ?? 'Conversation',
      otherName: other?.user.name ?? 'Unknown',
      lastMessage: last?.body.slice(0, 120) ?? null,
      lastAtLabel: relativeTime(row.updatedAt, now),
      // Unread means: someone else wrote since I last looked.
      unread: Boolean(
        last &&
          last.senderId !== userId &&
          (!me?.lastReadAt || last.createdAt > me.lastReadAt),
      ),
    }
  })
}

export async function findConversation(
  userId: string,
  conversationId: string,
): Promise<ConversationDetail | null> {
  const row = await prisma.conversation.findFirst({
    // Membership in the where clause: another pair's thread is not found rather
    // than fetched and then refused.
    where: { id: conversationId, participants: { some: { userId } } },
    select: {
      id: true,
      subject: true,
      updatedAt: true,
      applicationId: true,
      jobId: true,
      participants: {
        select: { userId: true, lastReadAt: true, user: { select: { name: true } } },
      },
      messages: {
        orderBy: { createdAt: 'asc' },
        take: 200,
        select: { id: true, body: true, senderId: true, createdAt: true },
      },
    },
  })

  if (!row) return null

  const now = new Date()
  const other = row.participants.find((p) => p.userId !== userId)

  return {
    id: row.id,
    subject: row.subject ?? 'Conversation',
    otherName: other?.user.name ?? 'Unknown',
    lastMessage: row.messages.at(-1)?.body ?? null,
    lastAtLabel: relativeTime(row.updatedAt, now),
    unread: false,
    applicationId: row.applicationId,
    jobId: row.jobId,
    messages: row.messages.map((m) => ({
      id: m.id,
      body: m.body,
      mine: m.senderId === userId,
      atLabel: relativeTime(m.createdAt, now),
    })),
  }
}

