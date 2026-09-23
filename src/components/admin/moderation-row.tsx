'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { ModerationStatus } from '@prisma/client'
import { Badge, Button, Card, Input, useToast } from '@/components/ui'
import { categoryLabel } from '@/config/categories'
import type { ModerationQueueItem } from '@/lib/db/repositories/employer.repository'
import { moderateJobAction } from '@/app/(admin)/admin/jobs/actions'

const TONE: Record<ModerationStatus, 'warn' | 'mint' | 'danger' | 'dark'> = {
  PENDING: 'warn',
  APPROVED: 'mint',
  FLAGGED: 'danger',
  REMOVED: 'dark',
}

const LABEL: Record<ModerationStatus, string> = {
  PENDING: 'Awaiting review',
  APPROVED: 'Approved',
  FLAGGED: 'Flagged',
  REMOVED: 'Removed',
}

export function ModerationRow({ job }: { job: ModerationQueueItem }) {
  const [decision, setDecision] = useState<ModerationStatus>(job.moderation)
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()
  const { show } = useToast()

  function decide(next: ModerationStatus) {
    // A removal or a flag without a reason leaves the employer with a dead
    // listing and no idea what to change.
    if (next !== 'APPROVED' && !reason.trim()) {
      show('Give a reason — the employer is told what it was.', 'error')
      return
    }

    startTransition(async () => {
      const result = await moderateJobAction(job.id, next, reason.trim() || undefined)
      if (result.error) {
        show(result.error, 'error')
        return
      }
      setDecision(next)
      setReason('')
      show(`Marked ${LABEL[next].toLowerCase()} — the employer has been notified`, 'success')
    })
  }

  return (
    <Card className="p-4.5">
      <div className="flex flex-wrap items-start justify-between gap-3.5">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <h3 className="m-0 text-[15px] font-extrabold">{job.title}</h3>
            <Badge tone={TONE[decision]}>{LABEL[decision]}</Badge>
            {job.status === 'DRAFT' && <Badge tone="dark">Draft</Badge>}
          </div>
          <div className="flex flex-wrap gap-2.5 text-xs text-muted">
            <span className="font-semibold text-navy">{job.companyName}</span>
            <span>{categoryLabel(job.category)}</span>
            <span>{job.location}</span>
            <span>{job.salaryLabel}</span>
            <span>Posted by {job.postedByName}</span>
            <span>Updated {job.submittedLabel}</span>
          </div>
          <p className="m-0 mt-2.5 text-[13px] leading-relaxed text-[#626d86]">{job.summary}</p>
        </div>

        {decision === 'APPROVED' && (
          <Link
            href={`/jobs-public/${job.id}`}
            className="shrink-0 text-[13px] font-bold text-blue hover:underline"
          >
            View live ↗
          </Link>
        )}
      </div>

      <div className="mt-3.5 grid gap-2.5 border-t border-line pt-3 sm:grid-cols-[1fr_auto]">
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason — required to flag or remove, sent to the employer"
          disabled={pending}
        />
        <div className="flex flex-wrap gap-2">
          {decision !== 'APPROVED' && (
            <Button type="button" size="sm" loading={pending} onClick={() => decide('APPROVED')}>
              Approve
            </Button>
          )}
          {decision !== 'FLAGGED' && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              loading={pending}
              onClick={() => decide('FLAGGED')}
            >
              Flag
            </Button>
          )}
          {decision !== 'REMOVED' && (
            <Button
              type="button"
              size="sm"
              variant="danger"
              loading={pending}
              onClick={() => decide('REMOVED')}
            >
              Remove
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}
