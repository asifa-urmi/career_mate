import type { Metadata } from 'next'
import { requireGroup } from '@/lib/auth/require-group'
import { ComingSoon } from '@/components/layout/coming-soon'

export const metadata: Metadata = { title: 'Candidates — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireGroup('employer')

  return (
    <ComingSoon
      title="Candidates"
      description="Applicants across your roles."
      phase="P1"
      does={[
        'Every applicant, filterable by role and stage.',
        'Their CV, answers and profile evidence.',
        'Move someone forward or decline with a reason.',
      ]}
      backHref="/employer"
      backLabel="Back to overview"
    />
  )
}
