import type { Metadata } from 'next'
import { requireGroup } from '@/lib/auth/require-group'
import { ComingSoon } from '@/components/layout/coming-soon'

export const metadata: Metadata = { title: 'Profile — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireGroup('candidate')

  return (
    <ComingSoon
      title="Profile"
      description="Experience, education, skills and visibility."
      phase="P1"
      does={[
        'Headline, location and a short summary.',
        'Work history, education, skills and certifications.',
        'Portfolio links.',
        'Control over what employers can see.',
      ]}
      backHref="/dashboard"
      backLabel="Back to dashboard"
    />
  )
}
