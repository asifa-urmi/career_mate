import type { Metadata } from 'next'
import { requireGroup } from '@/lib/auth/require-group'
import { ComingSoon } from '@/components/layout/coming-soon'

export const metadata: Metadata = { title: 'Saved jobs — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireGroup('candidate')

  return (
    <ComingSoon
      title="Saved jobs"
      description="Roles you bookmarked while browsing."
      phase="P1"
      does={[
        'Every role you saved, newest first.',
        'Apply or remove without leaving the list.',
        'A saved role that closes is marked, not silently dropped.',
      ]}
      backHref="/jobs"
      backLabel="Find jobs"
    />
  )
}
