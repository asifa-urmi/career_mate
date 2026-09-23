import type { Metadata } from 'next'
import { requireGroup } from '@/lib/auth/require-group'
import { PageHead } from '@/components/layout'
import { Button, Card, EmptyState, MetricCard } from '@/components/ui'
import { JobRow } from '@/components/employer/job-row'
import { companyIdForUser, listCompanyJobs } from '@/lib/db/repositories/employer.repository'

export const metadata: Metadata = { title: 'Manage jobs — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function ManageJobsPage() {
  const user = await requireGroup('employer')
  const companyId = await companyIdForUser(user.id)
  const jobs = companyId ? await listCompanyJobs(companyId) : []

  const live = jobs.filter((j) => j.status === 'PUBLISHED' && j.moderation === 'APPROVED').length
  const waiting = jobs.filter((j) => j.status === 'PUBLISHED' && j.moderation === 'PENDING').length
  const drafts = jobs.filter((j) => j.status === 'DRAFT').length

  return (
    <>
      <PageHead
        title="Manage jobs"
        description="Every role your company has posted, whoever posted it."
        actions={<Button href="/post-job">+ Post a job</Button>}
      />

      {jobs.length === 0 ? (
        <Card>
          <EmptyState
            glyph="▤"
            title="No jobs yet"
            body="Post your first role. It is saved as a draft, and goes to the public board once you publish it and moderation approves."
            action={<Button href="/post-job">Post a job</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-4.5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Live" value={live} />
            <MetricCard label="Awaiting moderation" value={waiting} />
            <MetricCard label="Drafts" value={drafts} />
            <MetricCard
              label="Applicants"
              value={jobs.reduce((sum, j) => sum + j.applicantCount, 0)}
            />
          </div>

          <ul className="grid list-none gap-3 p-0">
            {jobs.map((job) => (
              <li key={job.id}>
                <JobRow job={job} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
