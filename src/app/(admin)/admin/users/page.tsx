import type { Metadata } from 'next'
import { requireGroup } from '@/lib/auth/require-group'
import { ComingSoon } from '@/components/layout/coming-soon'

export const metadata: Metadata = { title: 'Users — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireGroup('admin')

  return (
    <ComingSoon
      title="Users"
      description="Accounts and roles across the platform."
      phase="P3"
      does={[
        'Every candidate, employer and admin.',
        'Suspend an account, or change a role.',
        'Every change recorded against the admin who made it.',
      ]}
      backHref="/admin"
      backLabel="Back to overview"
    />
  )
}
