import { requireGroup } from '@/lib/auth/require-group'
import { AppShell } from '@/components/layout'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireGroup('admin')

  return (
    <AppShell role="ADMIN" userName={user.name} userSubtitle="Platform operations">
      {children}
    </AppShell>
  )
}
