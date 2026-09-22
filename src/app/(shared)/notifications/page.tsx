import type { Metadata } from 'next'
import { requireGroup } from '@/lib/auth/require-group'
import { ComingSoon } from '@/components/layout/coming-soon'

export const metadata: Metadata = { title: 'Notifications — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireGroup('shared')

  return (
    <ComingSoon
      title="Notifications"
      description="Updates on your applications and messages."
      phase="P3"
      does={[
        'Application stage changes as they happen.',
        'New messages.',
        'Mark read, or clear everything.',
      ]}
      backHref="/dashboard"
      backLabel="Back to dashboard"
    />
  )
}
