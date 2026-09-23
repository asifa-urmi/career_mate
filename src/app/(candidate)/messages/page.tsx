import type { Metadata } from 'next'
import { requireGroup } from '@/lib/auth/require-group'
import { ComingSoon } from '@/components/layout/coming-soon'

export const metadata: Metadata = { title: 'Messages — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireGroup('candidate')

  return (
    <ComingSoon
      title="Messages"
      description="Conversations with employers."
      phase="P3"
      does={[
        'One thread per employer, tied to the role you applied for.',
        'Unread counts in the sidebar.',
      ]}
      backHref="/dashboard"
      backLabel="Back to dashboard"
    />
  )
}
