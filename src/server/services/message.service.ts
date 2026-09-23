import 'server-only'

import { prisma } from '@/lib/db/prisma'
import { appError } from '@/lib/utils/errors'
import { err, ok, type Result } from '@/lib/utils/result'
import type { SessionUser } from '@/lib/auth/session'

const MAX_MESSAGE_LENGTH = 5000

/**
 * Messaging is scoped to a real relationship.
 *
 * An employer can talk to someone who applied to one of their company's roles,
 * and to nobody else. Without that, a recruitment platform's inbox becomes a
 * cold-outreach channel aimed at people who never asked to hear from them — and
 * the candidate has no way to tell a genuine follow-up from a stranger.
 *
 * A candidate does not open threads. They reply in one an employer started,
 * which is the shape of the interaction and keeps the inbox meaningful.
 */
export async function startConversation(
  user: SessionUser,
  applicationId: string,
): Promise<Result<{ conversationId: string }>> {
  if (user.role !== 'EMPLOYER') {
    return err(
      appError('FORBIDDEN', 'Employers start conversations with people who applied to a role.'),
    )
  }

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      // The ownership predicate: this application went to a job posted by a
      // company this person works for. Never fetched first and checked after.
      const application = await tx.application.findFirst({
        where: {
          id: applicationId,
          job: { company: { employers: { some: { userId: user.id } } } },
        },
        select: {
          id: true,
          job: { select: { id: true, title: true } },
          candidateProfile: { select: { userId: true } },
        },
      })

      if (!application) return { kind: 'not-found' as const }

      // One application, one thread. Two parallel threads about the same
      // application would split the conversation in half.
      const existing = await tx.conversation.findFirst({
        where: { applicationId: application.id },
        select: { id: true },
      })
      if (existing) return { kind: 'ok' as const, conversationId: existing.id }

      const conversation = await tx.conversation.create({
        data: {
          applicationId: application.id,
          jobId: application.job.id,
          subject: application.job.title,
          participants: {
            create: [
              { userId: user.id },
              { userId: application.candidateProfile.userId },
            ],
          },
        },
        select: { id: true },
      })

      return { kind: 'ok' as const, conversationId: conversation.id }
    })

    if (outcome.kind === 'not-found') {
      return err(appError('NOT_FOUND', 'We could not find that application.'))
    }

    return ok({ conversationId: outcome.conversationId })
  } catch {
    return err(appError('INTERNAL', 'We could not open that conversation. Please try again.'))
  }
}

type SendOutcome = { kind: 'ok' } | { kind: 'not-a-participant' }

/**
 * Posts a message, and tells the other person — in one transaction, so a
 * notification cannot exist for a message that rolled back.
 */
export async function sendMessage(
  user: SessionUser,
  conversationId: string,
  body: string,
): Promise<Result<void>> {
  const trimmed = body.trim()
  if (!trimmed) return err(appError('VALIDATION', 'Write something first.'))
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return err(appError('VALIDATION', 'That message is too long.'))
  }

  try {
    const outcome = await prisma.$transaction(async (tx): Promise<SendOutcome> => {
      const membership = await tx.conversationParticipant.findFirst({
        where: { conversationId, userId: user.id },
        select: { id: true },
      })
      // Not found rather than forbidden: a distinguishable refusal confirms
      // which conversation ids are real.
      if (!membership) return { kind: 'not-a-participant' }

      await tx.message.create({
        data: { conversationId, senderId: user.id, body: trimmed },
      })

      // Orders the inbox by recent activity.
      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      })

      const others = await tx.conversationParticipant.findMany({
        where: { conversationId, userId: { not: user.id } },
        select: { userId: true },
      })

      for (const other of others) {
        const recipient = await tx.user.findUnique({
          where: { id: other.userId },
          select: { notifyOn: true },
        })

        // A notification someone asked not to receive is spam with extra steps.
        if (!recipient?.notifyOn.includes('NEW_MESSAGE')) continue

        await tx.notification.create({
          data: {
            userId: other.userId,
            type: 'NEW_MESSAGE',
            title: `New message from ${user.name}`,
            body: trimmed.slice(0, 160),
            href: '/messages',
          },
        })
      }

      return { kind: 'ok' }
    })

    if (outcome.kind === 'not-a-participant') {
      return err(appError('NOT_FOUND', 'We could not find that conversation.'))
    }

    return ok(undefined)
  } catch {
    return err(appError('INTERNAL', 'We could not send that message. Please try again.'))
  }
}

/** Marks a thread read for the caller only. */
export async function markConversationRead(
  user: SessionUser,
  conversationId: string,
): Promise<Result<void>> {
  try {
    const result = await prisma.conversationParticipant.updateMany({
      where: { conversationId, userId: user.id },
      data: { lastReadAt: new Date() },
    })
    if (result.count === 0) {
      return err(appError('NOT_FOUND', 'We could not find that conversation.'))
    }
    return ok(undefined)
  } catch {
    return err(appError('INTERNAL', 'Please try again.'))
  }
}
