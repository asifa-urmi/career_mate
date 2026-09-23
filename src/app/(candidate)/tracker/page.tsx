import type { Metadata } from 'next'
import { requireGroup } from '@/lib/auth/require-group'
import { PageHead } from '@/components/layout'
import { Button, Card, EmptyState, MetricCard } from '@/components/ui'
import { TrackerRow } from '@/components/applications/tracker-row'
import { candidateProfileIdFor } from '@/lib/db/repositories/saved-job.repository'
import { listCandidateApplications } from '@/lib/db/repositories/application.repository'

export const metadata: Metadata = { title: 'Applications — CareerMate' }
export const dynamic = 'force-dynamic'

const IN_PROGRESS = new Set(['SCREENING', 'INTERVIEW', 'ASSESSMENT', 'OFFER'])

export default async function TrackerPage() {
  const user = await requireGroup('candidate')
  const profileId = await candidateProfileIdFor(user.id)
  const applications = profileId ? await listCandidateApplications(profileId) : []

  const inProgress = applications.filter((a) => IN_PROGRESS.has(a.stage)).length
  const offers = applications.filter((a) => a.stage === 'OFFER').length
  const closed = applications.filter(
    (a) => a.stage === 'REJECTED' || a.stage === 'WITHDRAWN',
  ).length

  return (
    <>
      <PageHead
        title="Applications"
        description="Every role you applied to, and exactly where it stands."
        actions={<Button href="/jobs">Find more jobs</Button>}
      />

      {applications.length === 0 ? (
        <Card>
          <EmptyState
            glyph="◫"
            title="No applications yet"
            body="When you apply to a role it appears here, with a full history of every stage change."
            action={<Button href="/jobs">Browse jobs</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-4.5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Total" value={applications.length} />
            <MetricCard label="In progress" value={inProgress} />
            <MetricCard label="Offers" value={offers} />
            <MetricCard label="Closed" value={closed} />
          </div>

          <ul className="grid list-none gap-3 p-0">
            {applications.map((application) => (
              <li key={application.id}>
                <TrackerRow application={application} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
