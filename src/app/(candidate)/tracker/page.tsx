import type { Metadata } from 'next'
import { requireGroup } from '@/lib/auth/require-group'
import { ComingSoon } from '@/components/layout/coming-soon'

export const metadata: Metadata = { title: 'Applications — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireGroup('candidate')

  return (
    <ComingSoon
      title="Applications"
      description="Every application and where it stands."
      phase="P1"
      does={[
        'Applied, screening, interview, assessment, offer and rejected.',
        'A full history of stage changes, not just the current one.',
        'The CV each application was sent with.',
      ]}
      backHref="/jobs"
      backLabel="Find jobs"
    />
  )
}
