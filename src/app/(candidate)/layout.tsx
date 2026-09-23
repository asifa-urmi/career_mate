import { requireGroup } from '@/lib/auth/require-group'
import { AppShell } from '@/components/layout'
import { unreadNotificationCount } from '@/lib/db/repositories/notification.repository'
import { categoryLabel } from '@/config/categories'
import { prisma } from '@/lib/db/prisma'

export default async function CandidateLayout({ children }: { children: React.ReactNode }) {
  const user = await requireGroup('candidate')
  const unread = await unreadNotificationCount(user.id)

  const profile = await prisma.candidateProfile.findUnique({
    where: { userId: user.id },
    select: { primarySector: true },
  })

  return (
    <AppShell
      role="CANDIDATE"
      userName={user.name}
      unreadCount={unread}
      userSubtitle={profile ? categoryLabel(profile.primarySector) : 'Candidate'}
      primaryAction={{ href: '/jobs', label: 'Find jobs' }}
    >
      {children}
    </AppShell>
  )
}
