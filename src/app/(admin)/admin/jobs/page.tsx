import type { Metadata } from 'next'
import { requireGroup } from '@/lib/auth/require-group'
import { ComingSoon } from '@/components/layout/coming-soon'

export const metadata: Metadata = { title: 'Job moderation — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireGroup('admin')

  return (
    <ComingSoon
      title="Job moderation"
      description="Approve, flag or remove listings."
      phase="P3"
      does={[
        'The queue of roles awaiting moderation.',
        'Approve, flag or remove with a reason.',
        'Nothing reaches the public board until it is approved.',
      ]}
      backHref="/admin"
      backLabel="Back to overview"
    />
  )
}
