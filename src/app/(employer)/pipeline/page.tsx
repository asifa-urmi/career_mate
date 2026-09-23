import type { Metadata } from 'next'
import Link from 'next/link'
import { requireGroup } from '@/lib/auth/require-group'
import { PageHead } from '@/components/layout'
import { Button, Card, EmptyState } from '@/components/ui'
import { PipelineBoard } from '@/components/employer/pipeline-board'
import {
  companyIdForUser,
  listCompanyJobs,
} from '@/lib/db/repositories/employer.repository'
import {
  countPipeline,
  describePipeline,
  pipelineForCompany,
} from '@/lib/db/repositories/analytics.repository'
import { cn } from '@/lib/utils/cn'

export const metadata: Metadata = { title: 'Hiring pipeline — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string | string[] }>
}) {
  const user = await requireGroup('employer')
  const companyId = await companyIdForUser(user.id)

  const params = await searchParams
  // A repeated query key arrives as an array; passing that to Prisma for a
  // String column is a 500 on an authenticated page.
  const jobId = Array.isArray(params.jobId) ? params.jobId[0] : params.jobId

  const [columns, jobs, total] = companyId
    ? await Promise.all([
        pipelineForCompany(companyId, jobId),
        listCompanyJobs(companyId),
        countPipeline(companyId, jobId),
      ])
    : [[], [], 0]

  // Counted in the database, not taken from the board's length: the board is
  // capped, and reporting the cap as the total quietly hid every candidate past
  // it from an employer checking whether they had replied to everyone.
  const shown = columns.reduce((sum, c) => sum + c.applications.length, 0)

  return (
    <>
      <PageHead
        title="Hiring pipeline"
        description={describePipeline(shown, total)}
        actions={
          <Button href="/candidates" variant="ghost">
            List view
          </Button>
        }
      />

      {jobs.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          <Pill href="/pipeline" label="All roles" active={!jobId} />
          {jobs.map((job) => (
            <Pill
              key={job.id}
              href={`/pipeline?jobId=${job.id}`}
              label={job.title}
              active={jobId === job.id}
            />
          ))}
        </div>
      )}

      {total === 0 ? (
        <Card>
          <EmptyState
            glyph="◫"
            title="Nobody in the pipeline"
            body="Applications in progress show here as columns. Rejected and withdrawn ones are left out — they are not in the pipeline."
            action={<Button href="/post-job">Post a job</Button>}
          />
        </Card>
      ) : (
        <PipelineBoard columns={columns} />
      )}
    </>
  )
}

function Pill({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'rounded-[10px] border px-3 py-2 text-xs font-bold transition-colors',
        active
          ? 'border-[#c9d8ff] bg-blue-wash text-blue'
          : 'border-line bg-surface text-[#58617a] hover:border-[#cbd8ff]',
      )}
    >
      {label}
    </Link>
  )
}
