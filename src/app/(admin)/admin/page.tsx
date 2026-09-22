import type { Metadata } from 'next'
import { requireGroup } from '@/lib/auth/require-group'
import { PageHead } from '@/components/layout'
import { Badge, Card, CardTitle, MetricCard } from '@/components/ui'
import { QuickActions } from '@/components/ui/quick-actions'
import { adminDashboardStats } from '@/lib/db/repositories/dashboard.repository'

export const metadata: Metadata = { title: 'Platform admin — CareerMate' }
export const dynamic = 'force-dynamic'

const ACTIONS = [
  { href: '/admin/users', glyph: '◉', title: 'Users', subtitle: 'Accounts and roles' },
  { href: '/admin/jobs', glyph: '▤', title: 'Job moderation', subtitle: 'Approve or remove' },
  { href: '/admin/reports', glyph: '!', title: 'Reports', subtitle: 'Safety queue' },
  { href: '/jobs-public', glyph: '◈', title: 'Public board', subtitle: 'What visitors see' },
]

export default async function AdminDashboard() {
  await requireGroup('admin')
  const stats = await adminDashboardStats()

  const needsAttention = stats.pendingModeration + stats.openReports

  return (
    <>
      <PageHead
        title="Platform overview"
        description="Accounts, listings and the safety queue."
        actions={
          needsAttention > 0 ? (
            <Badge tone="warn">
              {needsAttention} {needsAttention === 1 ? 'item needs' : 'items need'} attention
            </Badge>
          ) : (
            <Badge tone="mint">Queues clear</Badge>
          )
        }
      />

      <div className="grid gap-4.5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard label="Candidates" value={stats.candidates} />
          <MetricCard label="Employers" value={stats.employers} />
          <MetricCard label="Live jobs" value={stats.publishedJobs} />
          <MetricCard label="Applications" value={stats.applications} />
          <MetricCard label="Awaiting moderation" value={stats.pendingModeration} />
          <MetricCard label="Open reports" value={stats.openReports} />
        </div>

        <QuickActions items={ACTIONS} />

        <Card padded>
          <CardTitle>What admin can do</CardTitle>
          <p className="m-0 text-[13px] leading-relaxed text-muted">
            Admin accounts are created by a direct database update, never by signing up — the
            signup form does not accept the role. An admin can read every workspace, which is
            why the audit trail on applications records who changed a stage.
          </p>
        </Card>
      </div>
    </>
  )
}
