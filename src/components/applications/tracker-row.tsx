'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Badge, Button, Card, CompanyMark, StatusChip, useToast } from '@/components/ui'
import { stageLabel } from '@/config/constants'
import { categoryLabel } from '@/config/categories'
import type { TrackedApplication } from '@/lib/db/repositories/application.repository'
import { withdrawAction } from '@/app/(candidate)/apply/[id]/actions'

/**
 * One application, expandable into its event history.
 *
 * The history is the point: a stage is a current value, and "Interview" tells
 * you nothing about whether that happened yesterday or six weeks ago. Every
 * stage change writes an event, and this is where they are read back.
 *
 * The history and answers arrive with the row rather than being fetched per
 * card, so a tracker with sixty applications is one query, not sixty-one.
 */
export function TrackerRow({ application }: { application: TrackedApplication }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const { show } = useToast()

  const canWithdraw =
    application.stage !== 'WITHDRAWN' && application.stage !== 'REJECTED'

  function withdraw() {
    if (!confirm('Withdraw this application? The employer will see that you withdrew.')) return

    startTransition(async () => {
      const result = await withdrawAction(application.id)
      if (result.error) {
        show(result.error, 'error')
        return
      }
      show('Application withdrawn')
    })
  }

  return (
    <Card className="p-4.5">
      <div className="flex flex-wrap items-start gap-3.5">
        <CompanyMark
          initials={application.logoInitials}
          className="bg-[linear-gradient(145deg,#dce6ff,#eff3ff)] !text-blue"
        />

        <div className="min-w-0 flex-1">
          <h3 className="m-0 mb-1 text-[15px] font-extrabold">
            <Link href={`/jobs/${application.jobId}`} className="hover:text-blue">
              {application.jobTitle}
            </Link>
          </h3>
          <div className="flex flex-wrap gap-2.5 text-xs text-muted">
            <span className="font-semibold text-navy">{application.companyName}</span>
            <span>{categoryLabel(application.category)}</span>
            <span>{application.location}</span>
            <span>Applied {application.appliedLabel}</span>
          </div>
          {application.resumeLabel && (
            <p className="m-0 mt-2 text-xs text-muted">CV sent: {application.resumeLabel}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusChip stage={application.stage} />
          <span className="text-[11px] text-muted">Updated {application.lastChangeLabel}</span>
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap gap-2.5 border-t border-line pt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? 'Hide history' : 'History'}
        </Button>
        {canWithdraw && (
          <Button type="button" variant="ghost" size="sm" onClick={withdraw} loading={pending}>
            Withdraw
          </Button>
        )}
      </div>

      {open && (
        <div className="mt-3 border-t border-line pt-3">
          {application.events.length > 0 ? (
            <ol className="m-0 grid list-none gap-2.5 p-0">
              {application.events.map((event) => (
                <li key={event.id} className="flex items-start gap-3">
                  <span
                    className="mt-1.5 size-2 shrink-0 rounded-full bg-mint"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <b className="block text-[13px]">
                      {event.fromStage
                        ? `${stageLabel(event.fromStage)} → ${stageLabel(event.toStage)}`
                        : stageLabel(event.toStage)}
                    </b>
                    <span className="block text-[11px] text-muted">{event.atLabel}</span>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="m-0 text-[13px] text-muted">No changes recorded yet.</p>
          )}

          {application.screening.length > 0 && (
            <div className="mt-4">
              <b className="mb-2 block text-xs text-navy">Your answers</b>
              <dl className="m-0 grid gap-2">
                {/* Keyed by index, not by question text: an employer can paste the
                    same question twice, and duplicate React keys make one answer
                    box's typing appear in the other. */}
                {application.screening.map((entry, i) => (
                  <div key={i} className="rounded-[10px] border border-line p-3">
                    <dt className="text-[13px] font-semibold">{entry.question}</dt>
                    <dd className="m-0 mt-1 text-[13px] leading-relaxed text-muted">
                      {entry.answer || <Badge tone="warn">Not answered</Badge>}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
