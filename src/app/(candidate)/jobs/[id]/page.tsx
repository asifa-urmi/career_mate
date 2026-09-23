import { Button } from '@/components/ui'
import { requireGroup } from '@/lib/auth/require-group'
import { JobDetail } from '@/components/jobs/job-detail'
import { SaveButton } from '@/components/jobs/save-button'
import { findApplicationForJob } from '@/lib/db/repositories/application.repository'
import { MatchExplainer } from '@/components/ai/match-explainer'
import { matchFor } from '@/lib/matching/match-for'
import {
  candidateProfileIdFor,
  savedJobIds,
} from '@/lib/db/repositories/saved-job.repository'

export const dynamic = 'force-dynamic'

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireGroup('candidate')
  const { id } = await params

  const profileId = await candidateProfileIdFor(user.id)
  const [saved, existingApplication, match] = await Promise.all([
    profileId ? savedJobIds(profileId) : Promise.resolve(new Set<string>()),
    profileId ? findApplicationForJob(profileId, id) : Promise.resolve(null),
    profileId ? matchFor(profileId, id) : Promise.resolve(null),
  ])

  return (
    <>
      {match && (
        <div className="mb-4.5">
          <MatchExplainer jobId={id} match={match} />
        </div>
      )}
      <JobDetail
      jobId={id}
      backHref="/jobs"
      backLabel="← All jobs"
      canReport
      cta={
        <>
          {existingApplication ? (
            <Button href="/tracker" variant="soft">
              Applied — track it
            </Button>
          ) : (
            <Button href={`/apply/${id}`}>Apply for this role</Button>
          )}
          <SaveButton jobId={id} saved={saved.has(id)} />
        </>
      }
      />
    </>
  )
}
