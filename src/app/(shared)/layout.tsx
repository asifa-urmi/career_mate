import { requireGroup } from '@/lib/auth/require-group'
import { AppShell } from '@/components/layout'
import { unreadNotificationCount } from '@/lib/db/repositories/notification.repository'
import { homePathFor } from '@/lib/auth/roles'

/**
 * Pages every signed-in role needs and none owns — settings and notifications.
 *
 * The shell is rendered with whatever role the caller actually has, so an
 * employer opening settings keeps their own sidebar rather than being shown a
 * candidate's.
 */
export default async function SharedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireGroup('shared')
  const unread = await unreadNotificationCount(user.id)

  return (
    <AppShell
      role={user.role}
      userName={user.name}
      userAvatarUrl={user.avatarUrl}
      unreadCount={unread}
      userSubtitle={user.email}
      primaryAction={{
        href: homePathFor(user.role),
        label: 'Back to workspace',
      }}
    >
      {children}
    </AppShell>
  )
}
