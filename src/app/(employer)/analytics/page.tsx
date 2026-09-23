import type { Metadata } from 'next'
import { requireGroup } from '@/lib/auth/require-group'
import { ComingSoon } from '@/components/layout/coming-soon'

export const metadata: Metadata = { title: 'Hiring analytics — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireGroup('employer')

  return (
    <ComingSoon
      title="Hiring analytics"
      description="How your roles and funnel are performing."
      phase="P3"
      does={[
        'Applications per role over time.',
        'Where candidates drop out of the funnel.',
        'Time to first response and time to hire.',
      ]}
      backHref="/employer"
      backLabel="Back to overview"
    />
  )
}
