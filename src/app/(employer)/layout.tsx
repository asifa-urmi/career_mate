import { requireGroup } from '@/lib/auth/require-group'
import { AppShell } from '@/components/layout'
import { unreadNotificationCount } from '@/lib/db/repositories/notification.repository'
import { prisma } from '@/lib/db/prisma'

export default async function EmployerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireGroup('employer')
  const unread = await unreadNotificationCount(user.id)

  const profile = await prisma.employerProfile.findUnique({
    where: { userId: user.id },
    select: { company: { select: { name: true, verified: true } } },
  })

  return (
    <AppShell
      role="EMPLOYER"
      userName={user.name}
      unreadCount={unread}
      userSubtitle={
        profile ? `${profile.company.name}${profile.company.verified ? ' · Verified' : ''}` : 'Employer'
      }
      primaryAction={{ href: '/post-job', label: '+ Post job' }}
    >
      {children}
    </AppShell>
  )
}
