import type { Metadata } from 'next'
import { requireGroup } from '@/lib/auth/require-group'
import { ComingSoon } from '@/components/layout/coming-soon'

export const metadata: Metadata = { title: 'Reports & safety — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireGroup('admin')

  return (
    <ComingSoon
      title="Reports &amp; safety"
      description="Reports raised about jobs and users."
      phase="P3"
      does={[
        'Open and in-review reports, oldest first.',
        'The job or account each one is about.',
        'Resolve or dismiss with a note.',
      ]}
      backHref="/admin"
      backLabel="Back to overview"
    />
  )
}
