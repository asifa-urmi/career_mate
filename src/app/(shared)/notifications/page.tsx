import type { Metadata } from 'next'
import Link from 'next/link'
import { requireGroup } from '@/lib/auth/require-group'
import { PageHead } from '@/components/layout'
import { Badge, Button, Card, EmptyState } from '@/components/ui'
import { listNotifications } from '@/lib/db/repositories/notification.repository'
import { homePathFor } from '@/lib/auth/roles'
import { cn } from '@/lib/utils/cn'
import { markAllReadAction } from './actions'

export const metadata: Metadata = { title: 'Notifications — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function NotificationsPage() {
  const user = await requireGroup('shared')
  const notifications = await listNotifications(user.id)
  const unread = notifications.filter((n) => !n.read).length

  return (
    <>
      <PageHead
        title="Notifications"
        description={
          unread === 0 ? 'Everything is read.' : `${unread} unread.`
        }
        actions={
          unread > 0 ? (
            <form action={markAllReadAction}>
              <Button type="submit" variant="ghost">
                Mark all read
              </Button>
            </form>
          ) : (
            <Button href={homePathFor(user.role)} variant="ghost">
              Back to workspace
            </Button>
          )
        }
      />

      {notifications.length === 0 ? (
        <Card>
          <EmptyState
            glyph="◌"
            title="Nothing yet"
            body="When an application changes stage, or someone messages you, it appears here."
            action={<Button href={homePathFor(user.role)}>Back to workspace</Button>}
          />
        </Card>
      ) : (
        <ul className="grid list-none gap-2.5 p-0">
          {notifications.map((n) => (
            <li key={n.id}>
              <Card
                className={cn(
                  'p-4',
                  !n.read && 'border-[#c9d8ff] bg-blue-wash/40',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <b className="text-sm">{n.title}</b>
                      {!n.read && <Badge tone="blue">New</Badge>}
                    </div>
                    <p className="m-0 text-[13px] leading-relaxed text-muted">{n.body}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="text-[11px] text-muted">{n.atLabel}</span>
                    {n.href && (
                      <Link
                        href={n.href}
                        className="text-[13px] font-bold text-blue hover:underline"
                      >
                        Open
                      </Link>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
