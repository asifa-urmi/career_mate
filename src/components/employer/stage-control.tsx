'use client'

import { useState, useTransition } from 'react'
import type { ApplicationStage } from '@prisma/client'
import { Button, Select, StatusChip, Textarea, useToast } from '@/components/ui'
import { changeStageAction } from '@/app/(employer)/candidates/actions'

/**
 * WITHDRAWN is deliberately absent: withdrawing is the candidate's act, and the
 * service refuses it from an employer. Offering it here would be a control that
 * always fails.
 */
const SETTABLE = [
  { value: 'APPLIED', label: 'Applied' },
  { value: 'SCREENING', label: 'Screening' },
  { value: 'INTERVIEW', label: 'Interview' },
  { value: 'ASSESSMENT', label: 'Assessment' },
  { value: 'OFFER', label: 'Offer' },
  { value: 'REJECTED', label: 'Not selected' },
]

export function StageControl({
  applicationId,
  stage,
  compact = false,
}: {
  applicationId: string
  stage: ApplicationStage
  compact?: boolean
}) {
  const [current, setCurrent] = useState<ApplicationStage>(stage)
  const [next, setNext] = useState<ApplicationStage>(stage)
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()
  const { show } = useToast()

  const locked = current === 'WITHDRAWN'

  function apply() {
    if (next === current) return

    startTransition(async () => {
      const result = await changeStageAction(applicationId, next, note || undefined)
      if (result.error) {
        setNext(current)
        show(result.error, 'error')
        return
      }
      setCurrent(next)
      setNote('')
      show('Stage updated — the candidate has been notified', 'success')
    })
  }

  if (locked) {
    return (
      <div className="grid gap-1.5">
        <StatusChip stage="WITHDRAWN" />
        <span className="text-[11px] text-muted">The candidate withdrew.</span>
      </div>
    )
  }

  return (
    <div className={compact ? 'flex items-center gap-2' : 'grid gap-2.5'}>
      <label className="sr-only" htmlFor={`stage-${applicationId}`}>
        Application stage
      </label>
      <Select
        id={`stage-${applicationId}`}
        options={SETTABLE}
        value={next}
        onChange={(e) => setNext(e.target.value as ApplicationStage)}
        className={compact ? 'w-40' : undefined}
        disabled={pending}
      />

      {!compact && (
        <Textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note — recorded in the history, not shown to the candidate"
          disabled={pending}
        />
      )}

      <Button
        type="button"
        size="sm"
        onClick={apply}
        disabled={next === current || pending}
        loading={pending}
      >
        {next === current ? 'No change' : 'Update stage'}
      </Button>
    </div>
  )
}
