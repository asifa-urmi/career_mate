import type { Metadata } from 'next'
import Link from 'next/link'
import type { ModerationStatus } from '@prisma/client'
import { requireGroup } from '@/lib/auth/require-group'
import { PageHead } from '@/components/layout'
import { Button, Card, EmptyState, MetricCard } from '@/components/ui'
import { ModerationRow } from '@/components/admin/moderation-row'
import {
  listJobsForModeration,
  moderationCounts,
} from '@/lib/db/repositories/employer.repository'
import { cn } from '@/lib/utils/cn'

export const metadata: Metadata = { title: 'Job moderation — CareerMate' }
export const dynamic = 'force-dynamic'

const FILTERS: { value: ModerationStatus | 'ALL'; label: string }[] = [
  { value: 'PENDING', label: 'Awaiting review' },
  { value: 'FLAGGED', label: 'Flagged' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REMOVED', label: 'Removed' },
  { value: 'ALL', label: 'Everything' },
]

const VALID = new Set<string>(['PENDING', 'APPROVED', 'FLAGGED', 'REMOVED'])

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>
}) {
  await requireGroup('admin')

  const params = await searchParams
  // A repeated query key arrives as an array; passing that to Prisma as an enum
  // is a 500 rather than a filter.
  const raw = Array.isArray(params.status) ? params.status[0] : params.status
  // Default to the queue that needs work rather than to everything.
  const status = raw === 'ALL' ? undefined : VALID.has(raw ?? '') ? (raw as ModerationStatus) : 'PENDING'

  const [jobs, counts] = await Promise.all([listJobsForModeration(status), moderationCounts()])

  return (
    <>
      <PageHead
        title="Job moderation"
        description="Nothing reaches the public board until it is approved here."
        actions={
          <Button href="/jobs-public" variant="ghost">
            See the public board
          </Button>
        }
      />

      <div className="mb-4.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Awaiting review" value={counts.PENDING} />
        <MetricCard label="Approved" value={counts.APPROVED} />
        <MetricCard label="Flagged" value={counts.FLAGGED} />
        <MetricCard label="Removed" value={counts.REMOVED} />
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = f.value === 'ALL' ? status === undefined : status === f.value
          return (
            <Link
              key={f.value}
              href={`/admin/jobs?status=${f.value}`}
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

      {jobs.length === 0 ? (
        <Card>
          <EmptyState
            glyph="✓"
            title={status === 'PENDING' ? 'Queue clear' : 'Nothing here'}
            body={
              status === 'PENDING'
                ? 'Every submitted listing has been reviewed.'
                : 'No jobs match that filter.'
            }
          />
        </Card>
      ) : (
        <ul className="grid list-none gap-3 p-0">
          {jobs.map((job) => (
            <li key={job.id}>
              <ModerationRow job={job} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
