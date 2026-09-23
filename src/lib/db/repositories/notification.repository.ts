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
