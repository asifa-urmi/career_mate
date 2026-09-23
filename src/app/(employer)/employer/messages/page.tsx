import type { Metadata } from 'next'
import { requireGroup } from '@/lib/auth/require-group'
import { ComingSoon } from '@/components/layout/coming-soon'

export const metadata: Metadata = { title: 'Messages — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireGroup('employer')

  return (
    <ComingSoon
      title="Messages"
      description="Conversations with candidates."
      phase="P3"
      does={[
        'One thread per candidate, tied to the role.',
        'Reply without leaving the workspace.',
      ]}
      backHref="/employer"
      backLabel="Back to overview"
    />
  )
}
