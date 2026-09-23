'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { ReportStatus } from '@prisma/client'
import { Badge, Button, Card, Input, useToast } from '@/components/ui'
import type { ReportRow as ReportRowModel } from '@/lib/db/repositories/report.repository'
import { resolveReportAction } from '@/app/(admin)/admin/reports/actions'

const TONE: Record<ReportStatus, 'warn' | 'blue' | 'mint' | 'dark'> = {
  OPEN: 'warn',
  REVIEWING: 'blue',
  RESOLVED: 'mint',
  DISMISSED: 'dark',
}

const LABEL: Record<ReportStatus, string> = {
  OPEN: 'Open',
  REVIEWING: 'In review',
  RESOLVED: 'Resolved',
  DISMISSED: 'Dismissed',
}

export function ReportRow({ report }: { report: ReportRowModel }) {
  const [status, setStatus] = useState<ReportStatus>(report.status)
  const [note, setNote] = useState('')
  const [pending, start] = useTransition()
  const { show } = useToast()

  function decide(next: ReportStatus) {
    start(async () => {
      const result = await resolveReportAction(report.id, next, note.trim() || undefined)
      if (result.error) {
        show(result.error, 'error')
        return
      }
      setStatus(next)
      setNote('')
      show(
        next === 'REVIEWING'
          ? 'Marked as in review'
          : 'Recorded — the reporter has been told what happened',
        'success',
      )
    })
  }

  const closed = status === 'RESOLVED' || status === 'DISMISSED'

  return (
    <Card className="p-4.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <b className="text-sm">{report.reason}</b>
            <Badge tone={TONE[status]}>{LABEL[status]}</Badge>
            <Badge tone="dark">{report.targetType === 'JOB' ? 'Job' : 'Account'}</Badge>
          </div>

          <p className="m-0 text-xs text-muted">
            Reported by {report.reporterName} · {report.filedLabel}
          </p>

          {/* A report outlives its target on purpose. The queue is a record of
              what was raised, so a deleted job must not erase the complaint. */}
          <p className="m-0 mt-1.5 text-[13px]">
            {report.targetLabel ? (
              report.targetHref ? (
                <Link href={report.targetHref} className="font-semibold text-blue hover:underline">
                  {report.targetLabel} ↗
                </Link>
              ) : (
                <span className="font-semibold">{report.targetLabel}</span>
              )
            ) : (
              <span className="text-muted">
                The {report.targetType === 'JOB' ? 'job' : 'account'} this was about no longer
                exists.
              </span>
            )}
          </p>

          {report.detail && (
            <p className="m-0 mt-2.5 rounded-[10px] bg-bg p-3 text-[13px] leading-relaxed text-[#626d86]">
              {report.detail}
            </p>
          )}

          {closed && report.resolutionNote && (
            <p className="m-0 mt-2.5 text-xs leading-relaxed text-muted">
              {report.resolvedByName ? `${report.resolvedByName}: ` : ''}
              {report.resolutionNote}
            </p>
          )}
        </div>
      </div>

      {!closed && (
        <div className="mt-3.5 grid gap-2.5 border-t border-line pt-3 sm:grid-cols-[1fr_auto]">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What you did — sent to the person who reported it"
            disabled={pending}
          />
          <div className="flex flex-wrap gap-2">
            {status === 'OPEN' && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                loading={pending}
                onClick={() => decide('REVIEWING')}
              >
                Take up
              </Button>
            )}
            <Button type="button" size="sm" loading={pending} onClick={() => decide('RESOLVED')}>
              Acted on it
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              loading={pending}
              onClick={() => decide('DISMISSED')}
            >
              No breach
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
