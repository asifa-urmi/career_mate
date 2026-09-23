import type { Metadata } from 'next'
import { requireGroup } from '@/lib/auth/require-group'
import { ComingSoon } from '@/components/layout/coming-soon'

export const metadata: Metadata = { title: 'Settings — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireGroup('shared')

  return (
    <ComingSoon
      title="Settings"
      description="Account, privacy and notifications."
      phase="P3"
      does={[
        'Change your email and password.',
        'Choose which notifications you receive.',
        'Control profile visibility.',
        'Export or delete your data.',
      ]}
      backHref="/dashboard"
      backLabel="Back to dashboard"
    />
  )
}
