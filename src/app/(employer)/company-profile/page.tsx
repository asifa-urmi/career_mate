import type { Metadata } from 'next'
import { requireGroup } from '@/lib/auth/require-group'
import { ComingSoon } from '@/components/layout/coming-soon'

export const metadata: Metadata = { title: 'Company profile — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireGroup('employer')

  return (
    <ComingSoon
      title="Company profile"
      description="What candidates see on your roles."
      phase="P1"
      does={[
        'Name, sector, size, location and website.',
        'A description candidates read on every post.',
        'Verification status.',
      ]}
      backHref="/employer"
      backLabel="Back to overview"
    />
  )
}
