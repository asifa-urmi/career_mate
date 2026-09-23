import type { Metadata } from 'next'
import { requireGroup } from '@/lib/auth/require-group'
import { PageHead } from '@/components/layout'
import { BarChart, Button, Card, CardTitle, EmptyState, MetricCard, Progress } from '@/components/ui'
import { companyIdForUser } from '@/lib/db/repositories/employer.repository'
import { hiringAnalytics } from '@/lib/db/repositories/analytics.repository'

export const metadata: Metadata = { title: 'Hiring analytics — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const user = await requireGroup('employer')
  const companyId = await companyIdForUser(user.id)
  const data = companyId ? await hiringAnalytics(companyId) : null

  if (!data || data.totalApplications === 0) {
    return (
      <>
        <PageHead title="Hiring analytics" description="How your roles and funnel are performing." />
        <Card>
          <EmptyState
            glyph="↗"
            title="Nothing to measure yet"
            body="Once people start applying, this shows your funnel, how fast you respond and where candidates drop out."
            action={<Button href="/post-job">Post a job</Button>}
          />
        </Card>
      </>
    )
  }

  const top = data.funnel[0]?.count ?? 0

  return (
    <>
      <PageHead
        title="Hiring analytics"
        description={`${data.totalApplications} applications across ${data.liveJobs} live ${data.liveJobs === 1 ? 'role' : 'roles'}.`}
      />

      <div className="grid gap-4.5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Applications" value={data.totalApplications} />
          <MetricCard label="Reached interview" value={`${data.interviewRate}%`} />
          <MetricCard label="Reached offer" value={`${data.offerRate}%`} />
          <MetricCard
            label="Days to first response"
            value={data.daysToFirstResponse ?? '—'}
            {...(data.daysToFirstResponse === null
              ? {}
              : { trend: data.daysToFirstResponse <= 3 ? 'Responsive' : 'Could be faster' })}
          />
        </div>

        <Card padded>
          <CardTitle>Applications over the last 30 days</CardTitle>
          <BarChart
            data={data.applicationsPerDay.map((d) => ({ label: d.label, value: d.count }))}
            caption="Applications received per day"
          />
        </Card>

        <div className="grid gap-4.5 lg:grid-cols-2">
          <Card padded>
            <CardTitle>Funnel</CardTitle>
            <p className="m-0 mb-4 text-[13px] leading-relaxed text-muted">
              Each stage counts everyone who reached it or went further — somebody at offer
              passed through screening, even though their record only shows where they are now.
            </p>
            <div className="grid gap-3">
              {data.funnel.map((stage) => (
                <div key={stage.key}>
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <b className="text-[13px]">{stage.label}</b>
                    <span className="text-[13px] text-muted">
                      {stage.count} · {top > 0 ? Math.round((stage.count / top) * 100) : 0}%
                    </span>
                  </div>
                  <Progress
                    value={top > 0 ? (stage.count / top) * 100 : 0}
                    label={`${stage.label}: ${stage.count}`}
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card padded>
            <CardTitle>Speed</CardTitle>
            <dl className="m-0 grid gap-3">
              <div className="flex items-baseline justify-between gap-3 border-b border-line pb-3">
                <dt className="text-[13px] text-muted">Average days to first response</dt>
                <dd className="m-0 font-display text-xl font-extrabold">
                  {data.daysToFirstResponse ?? '—'}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[13px] text-muted">Average days to offer</dt>
                <dd className="m-0 font-display text-xl font-extrabold">
                  {data.daysToOffer ?? '—'}
                </dd>
              </div>
            </dl>
            <p className="m-0 mt-4 text-xs leading-relaxed text-muted">
              A dash means nothing has moved yet — that is different from zero days, which would
              claim an instant response.
            </p>
          </Card>
        </div>
      </div>
    </>
  )
}
