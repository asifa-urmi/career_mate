import type { Metadata } from 'next'
import { requireGroup } from '@/lib/auth/require-group'
import { PageHead } from '@/components/layout'
import { AiCoach } from '@/components/ai/coach'
import { candidateProfileIdFor } from '@/lib/db/repositories/saved-job.repository'
import { coachJobOptions } from '@/lib/db/repositories/job.repository'

export const metadata: Metadata = { title: 'AI Career Coach — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function AiCoachPage() {
  const user = await requireGroup('candidate')
  const profileId = await candidateProfileIdFor(user.id)
  const jobs = profileId ? await coachJobOptions(profileId) : []

  return (
    <>
      <PageHead
        title="AI Career Coach"
        description="Grounded in your own profile. It will not invent experience you have not listed."
      />
      <AiCoach jobs={jobs} />
    </>
  )
}
