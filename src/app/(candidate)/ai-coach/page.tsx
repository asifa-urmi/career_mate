import type { Metadata } from 'next'
import { requireGroup } from '@/lib/auth/require-group'
import { ComingSoon } from '@/components/layout/coming-soon'

export const metadata: Metadata = { title: 'AI Career Coach — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireGroup('candidate')

  return (
    <ComingSoon
      title="AI Career Coach"
      description="Match explanations, CV help and interview practice."
      phase="P2"
      does={[
        'Why a role matches you, with evidence from your own profile.',
        'Cover letters and screening answers drafted from facts you provide.',
        'Sector-specific interview practice with feedback.',
        'Runs on free AI tiers with automatic failover, so one exhausted quota does not stop it.',
      ]}
      backHref="/dashboard"
      backLabel="Back to dashboard"
    />
  )
}
