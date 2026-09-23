import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReportStatus } from '@prisma/client'
import { requireGroup } from '@/lib/auth/require-group'
import { PageHead } from '@/components/layout'
import { Button, Card, EmptyState, MetricCard } from '@/components/ui'
import { ReportRow } from '@/components/admin/report-row'
import { listReports, reportCounts } from '@/lib/db/repositories/report.repository'
import { cn } from '@/lib/utils/cn'

export const metadata: Metadata = { title: 'Reports & safety — CareerMate' }
export const dynamic = 'force-dynamic'

const FILTERS = [
  { value: 'OPEN', label: 'Open' },
  { value: 'REVIEWING', label: 'In review' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'DISMISSED', label: 'Dismissed' },
  { value: 'ALL', label: 'Everything' },
] as const

const VALID = new Set<string>(['OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED'])

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>
}) {
  await requireGroup('admin')

  const params = await searchParams
  const raw = Array.isArray(params.status) ? params.status[0] : params.status
  // Defaults to the queue that needs work rather than to everything.
  const status =
    raw === 'ALL' ? undefined : VALID.has(raw ?? '') ? (raw as ReportStatus) : 'OPEN'

  const [reports, counts] = await Promise.all([listReports(status), reportCounts()])

  return (
    <>
      <PageHead
        title="Reports & safety"
        description="Whoever notices something wrong can report it. Everyone who does is told what happened."
        actions={
          <Button href="/admin" variant="ghost">
            Back to overview
          </Button>
        }
      />

      <div className="mb-4.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Open" value={counts.OPEN} />
        <MetricCard label="In review" value={counts.REVIEWING} />
        <MetricCard label="Resolved" value={counts.RESOLVED} />
        <MetricCard label="Dismissed" value={counts.DISMISSED} />
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = f.value === 'ALL' ? status === undefined : status === f.value
          return (
            <Link
              key={f.value}
              href={`/admin/reports?status=${f.value}`}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'rounded-[10px] border px-3 py-2 text-xs font-bold transition-colors',
                active
                  ? 'border-[#c9d8ff] bg-blue-wash text-blue'
                  : 'border-line bg-surface text-[#58617a] hover:border-[#cbd8ff]',
              )}
            >
              {f.label}
            </Link>
          )
        })}
      </div>

      {reports.length === 0 ? (
        <Card>
          <EmptyState
            glyph="✓"
            title={status === 'OPEN' ? 'Queue clear' : 'Nothing here'}
            body={
              status === 'OPEN'
                ? 'Nothing is waiting. Reports arrive from candidates and employers who spot a problem.'
                : 'No reports match that filter.'
            }
          />
        </Card>
      ) : (
        <ul className="grid list-none gap-3 p-0">
          {reports.map((report) => (
            <li key={report.id}>
              <ReportRow report={report} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
