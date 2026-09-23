'use client'

import { useState, useTransition } from 'react'
import type { ReportTargetType } from '@prisma/client'
import { Button, Card, Select, Textarea, useToast } from '@/components/ui'
import { REPORT_REASONS } from '@/lib/reports/reasons'
import { fileReportAction } from '@/app/(admin)/admin/reports/actions'

/**
 * Reporting is available to everyone signed in, not only to candidates.
 *
 * Whoever notices a misleading listing should be able to say so. The queue is
 * only as good as the range of people who can feed it.
 */
export function ReportButton({
  targetType,
  targetId,
  label = 'Report this',
}: {
  targetType: ReportTargetType
  targetId: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<string>(REPORT_REASONS[0])
  const [detail, setDetail] = useState('')
  const [pending, start] = useTransition()
  const { show } = useToast()

  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
    )
  }

  return (
    <Card padded className="mt-2">
      <div className="grid gap-2.5">
        <label htmlFor="report-reason" className="text-[13px] font-bold text-navy">
          What is wrong with this?
        </label>
        <Select
          id="report-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          options={REPORT_REASONS.map((r) => ({ value: r, label: r }))}
          disabled={pending}
        />

        <label htmlFor="report-detail" className="sr-only">
          Anything else
        </label>
        <Textarea
          id="report-detail"
          rows={3}
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="Anything else we should know (optional)"
          disabled={pending}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            loading={pending}
            onClick={() =>
              start(async () => {
                const result = await fileReportAction(
                  targetType,
                  targetId,
                  reason,
                  detail || undefined,
                )
                if (result.error) {
                  show(result.error, 'error')
                  return
                }
                setOpen(false)
                setDetail('')
                show('Reported — we will look at it and tell you what we find', 'success')
              })
            }
          >
            Send report
          </Button>
        </div>
      </div>
    </Card>
  )
}
