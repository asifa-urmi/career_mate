import type { Metadata } from 'next'
import Link from 'next/link'
import type { ApplicationStage } from '@prisma/client'
import { requireGroup } from '@/lib/auth/require-group'
import { PageHead } from '@/components/layout'
import { Avatar, Badge, Button, Card, EmptyState, SkillTag, StatusChip } from '@/components/ui'
import { StageControl } from '@/components/employer/stage-control'
import { APPLICATION_STAGES } from '@/config/constants'
import {
  companyIdForUser,
  listCompanyApplications,
  listCompanyJobs,
} from '@/lib/db/repositories/employer.repository'
import { cn } from '@/lib/utils/cn'

export const metadata: Metadata = { title: 'Candidates — CareerMate' }
export const dynamic = 'force-dynamic'

const VALID_STAGES = new Set(APPLICATION_STAGES.map((s) => s.value as string))

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string | string[]; stage?: string | string[] }>
}) {
  const user = await requireGroup('employer')
  const companyId = await companyIdForUser(user.id)

  const params = await searchParams
  // A repeated query key — ?jobId=a&jobId=b — arrives as an array. Handing that
  // to Prisma for a String column is a 500 on an authenticated page.
  const rawJobId = Array.isArray(params.jobId) ? params.jobId[0] : params.jobId
  const rawStage = Array.isArray(params.stage) ? params.stage[0] : params.stage

  // A crafted stage must not reach Prisma as an invalid enum.
  const stage =
    rawStage && VALID_STAGES.has(rawStage) ? (rawStage as ApplicationStage) : undefined

  const [applications, jobs] = companyId
    ? await Promise.all([
        // jobId needs no allow-list: the query ANDs `job: { companyId }`, so
        // another company's id matches zero rows and leaks nothing. It does need
        // to be a string, which is what the array check above is for.
        listCompanyApplications(companyId, { jobId: rawJobId, stage }),
        listCompanyJobs(companyId),
      ])
    : [[], []]

  const activeJob = jobs.find((j) => j.id === rawJobId)

  return (
    <>
      <PageHead
        title="Candidates"
        description={
          activeJob
            ? `Applicants for ${activeJob.title}.`
            : 'Everyone who has applied to one of your roles.'
        }
        actions={<Button href="/manage-jobs" variant="ghost">Manage jobs</Button>}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <Pill href="/candidates" label="All roles" active={!rawJobId} />
        {jobs.map((job) => (
          <Pill
            key={job.id}
            href={`/candidates?jobId=${job.id}`}
            label={`${job.title} (${job.applicantCount})`}
            active={rawJobId === job.id}
          />
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Pill
          href={rawJobId ? `/candidates?jobId=${rawJobId}` : '/candidates'}
          label="Any stage"
          active={!stage}
        />
        {APPLICATION_STAGES.map((s) => {
          const query = new URLSearchParams()
          if (rawJobId) query.set('jobId', rawJobId)
          query.set('stage', s.value)
          return (
            <Pill
              key={s.value}
              href={`/candidates?${query.toString()}`}
              label={s.label}
              active={stage === s.value}
            />
          )
        })}
      </div>

      {applications.length === 0 ? (
        <Card>
          <EmptyState
            glyph="◎"
            title="No applicants here yet"
            body={
              jobs.length === 0
                ? 'Post a role and applicants will appear here as they apply.'
                : 'Nothing matches that filter. Try another role or stage.'
            }
            action={
              jobs.length === 0 ? (
                <Button href="/post-job">Post a job</Button>
              ) : (
                <Button href="/candidates" variant="ghost">
                  Clear filters
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <ul className="grid list-none gap-3 p-0">
          {applications.map((a) => (
            <li key={a.id}>
              <Card className="p-4.5">
                <div className="flex flex-wrap items-start gap-3.5">
                  <Avatar name={a.candidateName} size={48} />

                  <div className="min-w-0 flex-1">
                    <h3 className="m-0 mb-1 text-[15px] font-extrabold">
                      <Link href={`/candidates/${a.id}`} className="hover:text-blue">
                        {a.candidateName}
                      </Link>
                    </h3>
                    <p className="m-0 text-xs text-muted">
                      {a.headline ?? 'No headline yet'}
                      {a.location && ` · ${a.location}`}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2.5 text-xs text-muted">
                      <span className="font-semibold text-navy">{a.jobTitle}</span>
                      <span>Applied {a.appliedLabel}</span>
                      {a.hasResume ? (
                        <Badge tone="mint">CV attached</Badge>
                      ) : (
                        <Badge tone="dark">No CV</Badge>
                      )}
                    </div>
                    {a.skills.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {a.skills.map((s) => (
                          <SkillTag key={s}>{s}</SkillTag>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2.5">
                    <StatusChip stage={a.stage} />
                    <StageControl applicationId={a.id} stage={a.stage} compact />
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
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
