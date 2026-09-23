import { requireGroup } from '@/lib/auth/require-group'
import { AppShell } from '@/components/layout'
import { unreadNotificationCount } from '@/lib/db/repositories/notification.repository'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireGroup('admin')
  const unread = await unreadNotificationCount(user.id)

  return (
    <AppShell
      role="ADMIN"
      userName={user.name}
      userAvatarUrl={user.avatarUrl}
      userSubtitle="Platform operations"
      unreadCount={unread}
    >
      {children}
    </AppShell>
  )
}
