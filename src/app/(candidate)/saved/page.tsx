import type { Metadata } from 'next'
import { requireGroup } from '@/lib/auth/require-group'
import { PageHead } from '@/components/layout'
import { Badge, Button, Card, EmptyState } from '@/components/ui'
import { JobCard } from '@/components/jobs/job-card'
import { SaveButton } from '@/components/jobs/save-button'
import {
  candidateProfileIdFor,
  listSavedJobs,
} from '@/lib/db/repositories/saved-job.repository'

export const metadata: Metadata = { title: 'Saved jobs — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function SavedJobsPage() {
  const user = await requireGroup('candidate')
  const profileId = await candidateProfileIdFor(user.id)
  const jobs = profileId ? await listSavedJobs(profileId) : []

  const open = jobs.filter((j) => j.stillOpen)
  const closed = jobs.filter((j) => !j.stillOpen)

  return (
    <>
      <PageHead
        title="Saved jobs"
        description={
          jobs.length === 0
            ? 'Roles you bookmark while browsing appear here.'
            : `${open.length} still open${closed.length > 0 ? `, ${closed.length} closed` : ''}.`
        }
        actions={<Button href="/jobs">Find more jobs</Button>}
      />

      {jobs.length === 0 ? (
        <Card>
          <EmptyState
            glyph="♡"
            title="Nothing saved yet"
            body="Tap the heart on any role to keep it here while you decide."
            action={<Button href="/jobs">Browse jobs</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-6">
          {open.length > 0 && (
            <ul className="grid list-none gap-3 p-0">
              {open.map((job) => (
                <li key={job.id}>
                  <JobCard
                    job={job}
                    href={`/jobs/${job.id}`}
                    action={<SaveButton jobId={job.id} saved label={false} />}
                  />
                </li>
              ))}
            </ul>
          )}

          {closed.length > 0 && (
            <div>
              <h2 className="mb-3 font-display text-base font-extrabold text-muted">
                No longer accepting applications
              </h2>
              <ul className="grid list-none gap-3 p-0">
                {closed.map((job) => (
                  <li key={job.id} className="opacity-70">
                    <JobCard
                      job={job}
                      href={`/jobs/${job.id}`}
                      action={
                        <div className="grid justify-items-end gap-2">
                          <Badge tone="warn">Closed</Badge>
                          <SaveButton jobId={job.id} saved label={false} />
                        </div>
                      }
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </>
  )
}
