import type { Metadata } from 'next'
import { requireGroup } from '@/lib/auth/require-group'
import { ComingSoon } from '@/components/layout/coming-soon'

export const metadata: Metadata = { title: 'Post a job — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireGroup('employer')

  return (
    <ComingSoon
      title="Post a job"
      description="Publish a role in any sector."
      phase="P1"
      does={[
        'Sector-specific guidance for the requirements that matter.',
        'Salary range, work mode, job type and location.',
        'Screening questions candidates answer when applying.',
        'Save as a draft, or publish for moderation.',
      ]}
      backHref="/employer"
      backLabel="Back to overview"
    />
  )
}
