'use client'

import Link from 'next/link'
import { Avatar, Badge, Card } from '@/components/ui'
import { StageControl } from './stage-control'
import type { PipelineColumn } from '@/lib/db/repositories/analytics.repository'

/**
 * Five columns, one per progressing stage.
 *
 * Moving someone uses the same `StageControl` the candidate list uses, which
 * calls the same action and the same service — so there is exactly one path a
 * stage change can take, and exactly one place its authorization and its event
 * are written.
 */
export function PipelineBoard({ columns }: { columns: PipelineColumn[] }) {
  return (
    <div className="grid gap-3 lg:grid-cols-5">
      {columns.map((column) => (
        <div
          key={column.stage}
          className="rounded-[14px] border border-line bg-[#f7f9fd] p-3"
        >
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <b className="text-xs font-extrabold">{column.label}</b>
            <Badge tone={column.applications.length > 0 ? 'blue' : 'dark'}>
              {column.applications.length}
            </Badge>
          </div>

          <div className="grid min-h-[260px] content-start gap-2.5">
            {column.applications.length === 0 ? (
              <p className="m-0 px-1 text-[11px] text-muted">Nobody here.</p>
            ) : (
              column.applications.map((application) => (
                <Card key={application.id} className="p-3">
                  <div className="flex items-start gap-2.5">
                    <Avatar name={application.candidateName} size={30} />
                    <div className="min-w-0 flex-1">
                      <b className="block truncate text-[13px]">
                        <Link
                          href={`/candidates/${application.id}`}
                          className="hover:text-blue"
                        >
                          {application.candidateName}
                        </Link>
                      </b>
                      <span className="block truncate text-[11px] text-muted">
                        {application.headline ?? application.jobTitle}
                      </span>
                      <span className="block text-[10px] text-muted">
                        Applied {application.appliedLabel}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2.5 border-t border-line pt-2.5">
                    <StageControl
                      applicationId={application.id}
                      stage={column.stage}
                      compact
                    />
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
