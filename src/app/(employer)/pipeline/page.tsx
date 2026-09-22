import type { Metadata } from 'next'
import { requireGroup } from '@/lib/auth/require-group'
import { ComingSoon } from '@/components/layout/coming-soon'

export const metadata: Metadata = { title: 'Hiring pipeline — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireGroup('employer')

  return (
    <ComingSoon
      title="Hiring pipeline"
      description="Move people through your stages."
      phase="P3"
      does={[
        'A column per stage with every candidate in it.',
        'Move someone and the change is recorded with who did it.',
      ]}
      backHref="/employer"
      backLabel="Back to overview"
    />
  )
}
