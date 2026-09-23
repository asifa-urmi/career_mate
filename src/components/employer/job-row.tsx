'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { Badge, Button, Card, useToast } from '@/components/ui'
import { categoryLabel } from '@/config/categories'
import type { EmployerJobModel } from '@/lib/db/repositories/employer.repository'
import { closeJobAction, publishJobAction } from '@/app/(employer)/post-job/actions'

/**
 * Status and moderation are shown separately because they mean different
 * things. An employer who publishes a job and does not see it on the board
 * needs to know it is waiting on moderation rather than assume it failed.
 */
function StatusBadges({ job }: { job: EmployerJobModel }) {
  if (job.status === 'DRAFT') return <Badge tone="dark">Draft</Badge>
  if (job.status === 'CLOSED') return <Badge tone="warn">Closed</Badge>

  if (job.moderation === 'APPROVED') return <Badge tone="mint">Live</Badge>
  if (job.moderation === 'PENDING') return <Badge tone="warn">Awaiting moderation</Badge>
  if (job.moderation === 'FLAGGED') return <Badge tone="danger">Flagged for review</Badge>
  return <Badge tone="danger">Removed</Badge>
}

export function JobRow({ job }: { job: EmployerJobModel }) {
  const [pending, startTransition] = useTransition()
  const { show } = useToast()

  function run(fn: (id: string) => Promise<{ error?: string }>, success: string) {
    startTransition(async () => {
      const result = await fn(job.id)
      show(result.error ?? success, result.error ? 'error' : 'success')
    })
  }

  return (
    <Card className="p-4.5">
      <div className="flex flex-wrap items-start justify-between gap-3.5">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <h3 className="m-0 text-[15px] font-extrabold">{job.title}</h3>
            <StatusBadges job={job} />
          </div>
          <div className="flex flex-wrap gap-2.5 text-xs text-muted">
            <span>{categoryLabel(job.category)}</span>
            <span>{job.location}</span>
            <span>{job.salaryLabel}</span>
            <span>Updated {job.updatedLabel}</span>
          </div>
        </div>

        <div className="text-right">
          <strong className="block font-display text-2xl leading-none">
            {job.applicantCount}
          </strong>
          <span className="text-[11px] text-muted">
            {job.applicantCount === 1 ? 'applicant' : 'applicants'}
            {job.newCount > 0 && <span className="text-blue"> · {job.newCount} new</span>}
          </span>
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap gap-2.5 border-t border-line pt-3">
        <Button href={`/candidates?jobId=${job.id}`} variant="soft" size="sm">
          Review applicants
        </Button>
        <Link
          href={`/manage-jobs/${job.id}`}
          className="inline-flex items-center rounded-[var(--radius-field)] border border-line px-3.5 py-2 text-[13px] font-bold text-navy hover:bg-surface"
        >
          Edit
        </Link>

        {job.status === 'DRAFT' && (
          <Button
            type="button"
            size="sm"
            loading={pending}
            onClick={() => run(publishJobAction, 'Published — it goes live once moderation approves it')}
          >
            Publish
          </Button>
        )}

        {job.status === 'PUBLISHED' && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            loading={pending}
            onClick={() => run(closeJobAction, 'Job closed')}
          >
            Close
          </Button>
        )}
      </div>
    </Card>
  )
}
