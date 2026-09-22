import type { Metadata } from 'next'
import { requireGroup } from '@/lib/auth/require-group'
import { PageHead } from '@/components/layout'
import { Button, Card, CardTitle, EmptyState, MetricCard } from '@/components/ui'
import { AiBanner, QuickActions } from '@/components/ui/quick-actions'
import { employerDashboardStats } from '@/lib/db/repositories/dashboard.repository'

export const metadata: Metadata = { title: 'Employer workspace — CareerMate' }
export const dynamic = 'force-dynamic'

const ACTIONS = [
  { href: '/post-job', glyph: '＋', title: 'Post a job', subtitle: 'Any sector' },
  { href: '/manage-jobs', glyph: '▤', title: 'Manage jobs', subtitle: 'Edit and close' },
  { href: '/candidates', glyph: '◎', title: 'Candidates', subtitle: 'Review applicants' },
  { href: '/pipeline', glyph: '◫', title: 'Pipeline', subtitle: 'Move people through' },
]

export default async function EmployerDashboard() {
  const user = await requireGroup('employer')
  const stats = await employerDashboardStats(user.id)

  if (!stats) {
    return (
      <Card padded>
        <EmptyState
          glyph="▦"
          title="Your company profile is missing"
          body="Finish company setup to open the employer workspace."
          action={<Button href="/company-setup">Finish setup</Button>}
        />
      </Card>
    )
  }

  const noJobsYet = stats.publishedJobs === 0 && stats.draftJobs === 0

  return (
    <>
      <PageHead
        title={stats.companyName}
        description="Post roles, review candidates and move them through your hiring pipeline."
        actions={<Button href="/post-job">+ Post a job</Button>}
      />

      <div className="grid gap-4.5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Live jobs" value={stats.publishedJobs} />
          <MetricCard label="Drafts" value={stats.draftJobs} />
          <MetricCard
            label="Applications"
            value={stats.totalApplications}
            trend={stats.newThisWeek > 0 ? `+${stats.newThisWeek} this week` : undefined}
          />
          <MetricCard label="In interview" value={stats.interviewing} />
        </div>

        <QuickActions items={ACTIONS} />

        {noJobsYet ? (
          <Card padded>
            <EmptyState
              glyph="＋"
              title="You have not posted a role yet"
              body="Post your first job and it will appear on the public board as soon as it passes moderation."
              action={<Button href="/post-job">Post a job</Button>}
            />
          </Card>
        ) : (
          <Card padded>
            <CardTitle>Recent activity</CardTitle>
            {stats.totalApplications === 0 ? (
              <EmptyState
                glyph="◎"
                title="No applications yet"
                body="Your roles are live. Applications will appear here as candidates apply."
                action={
                  <Button href="/manage-jobs" variant="ghost">
                    Review your jobs
                  </Button>
                }
              />
            ) : (
              <p className="m-0 text-[13px] leading-relaxed text-muted">
                {stats.totalApplications}{' '}
                {stats.totalApplications === 1 ? 'application' : 'applications'} received,{' '}
                {stats.interviewing} at interview stage.{' '}
                <a href="/candidates" className="font-bold text-blue">
                  Review candidates
                </a>
                .
              </p>
            )}
          </Card>
        )}

        <AiBanner
          title="Employer AI assistant"
          body="Sharpen a job description, and summarise the evidence in a candidate's application. Hiring decisions stay with you."
          action={
            <Button href="/post-job" variant="mint" size="sm">
              Write a job post
            </Button>
          }
        />
      </div>
    </>
  )
}
