import { Button } from '@/components/ui'
import { requireGroup } from '@/lib/auth/require-group'
import { JobDetail } from '@/components/jobs/job-detail'
import { SaveButton } from '@/components/jobs/save-button'
import {
  candidateProfileIdFor,
  savedJobIds,
} from '@/lib/db/repositories/saved-job.repository'

export const dynamic = 'force-dynamic'

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireGroup('candidate')
  const { id } = await params

  const profileId = await candidateProfileIdFor(user.id)
  const saved = profileId ? await savedJobIds(profileId) : new Set<string>()

  return (
    <JobDetail
      jobId={id}
      backHref="/jobs"
      backLabel="← All jobs"
      cta={
        <>
          {/* The apply route lands in Task 4; linking to it before then would
              ship exactly the dead link the P0 review found on every job card. */}
          <Button href="/jobs" variant="ghost">
            Applying arrives shortly
          </Button>
          <SaveButton jobId={id} saved={saved.has(id)} />
        </>
      }
    />
  )
}
