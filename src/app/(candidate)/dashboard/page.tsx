import type { Metadata } from 'next'
import Link from 'next/link'
import { requireGroup } from '@/lib/auth/require-group'
import { PageHead } from '@/components/layout'
import {
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  MetricCard,
  Progress,
} from '@/components/ui'
import { AiBanner, QuickActions } from '@/components/ui/quick-actions'
import { JobList } from '@/components/jobs/job-card'
import { candidateDashboardStats } from '@/lib/db/repositories/dashboard.repository'
import { listPublishedJobs } from '@/lib/db/repositories/job.repository'
import { categoryLabel } from '@/config/categories'
import type { JobCategory } from '@prisma/client'

export const metadata: Metadata = { title: 'Dashboard — CareerMate' }
export const dynamic = 'force-dynamic'

const ACTIONS = [
  { href: '/jobs', glyph: '⌕', title: 'Find jobs', subtitle: 'Search every sector' },
  { href: '/resume', glyph: '▤', title: 'CV & Resume', subtitle: 'Upload and manage' },
  { href: '/tracker', glyph: '◫', title: 'Applications', subtitle: 'Track your progress' },
  { href: '/profile', glyph: '◉', title: 'Profile', subtitle: 'Keep it current' },
]

export default async function CandidateDashboard() {
  const user = await requireGroup('candidate')
  const stats = await candidateDashboardStats(user.id)

  // Lead with the sector they chose during onboarding, falling back to
  // everything if they have not picked one.
  const recommended = await listPublishedJobs({
    category: (stats.primarySector as JobCategory | null) ?? undefined,
    take: 5,
  })
  const fallback = recommended.length === 0 ? await listPublishedJobs({ take: 5 }) : []
  const jobs = recommended.length > 0 ? recommended : fallback

  const firstName = user.name.split(' ')[0] ?? user.name

  return (
    <>
      <PageHead
        title={`Welcome back, ${firstName}`}
        description={
          stats.primarySector
            ? `Leading with ${categoryLabel(stats.primarySector as JobCategory)} roles. You can search any sector.`
            : 'Search jobs across every sector.'
        }
        actions={<Button href="/jobs">Find jobs</Button>}
      />

      <div className="grid gap-4.5 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-4.5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Applications" value={stats.applications} />
            <MetricCard label="In progress" value={stats.inProgress} />
            <MetricCard label="Saved jobs" value={stats.savedJobs} />
            <MetricCard label="CVs on file" value={stats.resumes} />
          </div>

          <QuickActions items={ACTIONS} />

          <Card padded>
            <div className="mb-3.5 flex items-center justify-between gap-3">
              <CardTitle className="mb-0">
                {recommended.length > 0 ? 'Recommended for you' : 'Latest roles'}
              </CardTitle>
              <Button href="/jobs" variant="ghost" size="sm">
                See all
              </Button>
            </div>

            {jobs.length === 0 ? (
              <EmptyState
                glyph="⌕"
                title="No roles published yet"
                body="Employers post roles from their workspace. Check back shortly, or browse every sector."
                action={
                  <Button href="/jobs" variant="ghost">
                    Browse jobs
                  </Button>
                }
              />
            ) : (
              <JobList jobs={jobs} hrefFor={(job) => `/jobs/${job.id}`} />
            )}
          </Card>
        </div>

        <div className="grid content-start gap-4.5">
          <Card padded>
            <CardTitle>Profile strength</CardTitle>
            <div className="mb-2 flex items-baseline justify-between">
              <strong className="font-display text-[28px] leading-none">
                {stats.profileCompleteness}%
              </strong>
              {stats.profileCompleteness === 100 && <Badge tone="mint">Complete</Badge>}
            </div>
            <Progress value={stats.profileCompleteness} label="Profile completeness" />

            {stats.missingSignals.length > 0 ? (
              <>
                <p className="mt-4 mb-2 text-xs font-bold text-navy">Still missing</p>
                <ul className="grid list-none gap-1.5 p-0">
                  {stats.missingSignals.map((signal) => (
                    <li key={signal.label}>
                      <Link
                        href={signal.href}
                        className="flex items-center justify-between rounded-[10px] border border-line px-3 py-2 text-[13px] hover:border-[#cbd8ff]"
                      >
                        {signal.label}
                        <span aria-hidden="true" className="text-muted">
                          →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-4 mb-0 text-[13px] leading-relaxed text-muted">
                Every section is filled in. Employers see the whole picture.
              </p>
            )}
          </Card>

          <AiBanner
            title="AI Career Coach"
            body="Match explanations, CV suggestions, cover-letter drafts and interview practice, grounded in what you have actually done."
            action={
              <Button href="/ai-coach" variant="mint" size="sm">
                Open the coach
              </Button>
            }
          />
        </div>
      </div>
    </>
  )
}
