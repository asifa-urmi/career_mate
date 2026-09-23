import { type NotificationType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { relativeTime } from '@/lib/utils/format'

export async function unreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } })
}

export type NotificationModel = {
  id: string
  title: string
  body: string
  href: string | null
  read: boolean
  atLabel: string
}

export async function listNotifications(userId: string): Promise<NotificationModel[]> {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, title: true, body: true, href: true, readAt: true, createdAt: true },
  })

  const now = new Date()
  return rows.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    href: n.href,
    read: n.readAt !== null,
    atLabel: relativeTime(n.createdAt, now),
  }))
}

/** Scoped to the owner, so one person cannot mark another's notifications read. */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  })
}

/**
 * The one place a notification is written.
 *
 * Every writer goes through here so that a preference cannot be honoured by one
 * of them and ignored by the rest — which is what happened: only messaging
 * consulted `notifyOn`, so three of the four toggles in settings did nothing at
 * all while the panel said "Saved."
 *
 * SYSTEM is the exception and is always delivered. It carries suspensions,
 * moderation outcomes and account changes; someone who turned notifications off
 * did not thereby opt out of being told their account was suspended, which is
 * the one message they most need and the only thing they can appeal against.
 *
 * Takes a transaction handle rather than reaching for `prisma`, because every
 * caller writes the notification in the same transaction as the change it is
 * about.
 */
export type NotifyTx = Pick<Prisma.TransactionClient, 'user' | 'notification'>

export async function notifyUser(
  tx: NotifyTx,
  userId: string,
  payload: { type: NotificationType; title: string; body: string; href?: string | null },
): Promise<void> {
  if (payload.type !== 'SYSTEM') {
    const recipient = await tx.user.findUnique({
      where: { id: userId },
      select: { notifyOn: true },
    })

    // A notification someone asked not to receive is spam with extra steps.
    if (!recipient?.notifyOn.includes(payload.type)) return
  }

  await tx.notification.create({ data: { userId, ...payload } })
}
