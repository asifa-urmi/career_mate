import type { Metadata } from 'next'
import { requireGroup } from '@/lib/auth/require-group'
import { ComingSoon } from '@/components/layout/coming-soon'

export const metadata: Metadata = { title: 'Manage jobs — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireGroup('employer')

  return (
    <ComingSoon
      title="Manage jobs"
      description="Edit, pause and close your roles."
      phase="P1"
      does={[
        'Every role with its status and applicant count.',
        'Edit a live role or close it.',
        'See what moderation is holding.',
      ]}
      backHref="/employer"
      backLabel="Back to overview"
    />
  )
}
