import { notFound } from 'next/navigation'
import { Badge, Button, Card, CardTitle, CompanyMark, SkillTag } from '@/components/ui'
import { categoryLabel } from '@/config/categories'
import { JOB_TYPES, WORK_MODES } from '@/config/constants'
import { findPublishedJob } from '@/lib/db/repositories/job.repository'

const WORK_MODE_LABEL = new Map(WORK_MODES.map((m) => [m.value, m.label]))
const JOB_TYPE_LABEL = new Map(JOB_TYPES.map((t) => [t.value, t.label]))

/**
 * One job, shared by the public and signed-in boards.
 *
 * The only difference between them is the call to action, which is passed in —
 * a visitor is invited to create an account, a candidate to apply. Everything
 * else about a job is public, so there is no second copy of it to drift.
 */
export async function JobDetail({
  jobId,
  cta,
  backHref,
  backLabel,
}: {
  jobId: string
  cta: React.ReactNode
  backHref: string
  backLabel: string
}) {
  const job = await findPublishedJob(jobId)

  // A closed or unmoderated job is not found rather than forbidden: the fact
  // that an id exists is not something a public page should confirm.
  if (!job) notFound()

  return (
    <div className="grid gap-4.5 lg:grid-cols-[1fr_320px]">
      <div className="grid gap-4.5">
        <Card padded className="p-6">
          <div className="flex flex-wrap items-start gap-4">
            <CompanyMark
              initials={job.logoInitials}
              size={58}
              className="bg-[linear-gradient(145deg,#dce6ff,#eff3ff)] !text-blue"
            />
            <div className="min-w-0 flex-1">
              <h1 className="m-0 mb-1.5 font-display text-[28px] leading-tight font-extrabold">
                {job.title}
              </h1>
              <p className="m-0 text-sm font-semibold text-navy">{job.companyName}</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Badge tone="dark">{categoryLabel(job.category)}</Badge>
                <Badge tone="dark">{job.location}</Badge>
                <Badge tone="dark">{WORK_MODE_LABEL.get(job.workMode)}</Badge>
                <Badge tone="dark">{JOB_TYPE_LABEL.get(job.jobType)}</Badge>
                <Badge tone="mint">{job.salaryLabel}</Badge>
              </div>
            </div>
          </div>

          <p className="mt-5 mb-0 text-[15px] leading-relaxed text-[#626d86]">{job.summary}</p>

          <div className="mt-5 flex flex-wrap gap-2.5">{cta}</div>
        </Card>

        {job.responsibilities.length > 0 && (
          <Card padded className="p-5.5">
            <CardTitle>What you will do</CardTitle>
            <ul className="m-0 grid list-disc gap-2 pl-5">
              {job.responsibilities.map((item) => (
                <li key={item} className="text-sm leading-relaxed text-[#626d86]">
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {job.requirements.length > 0 && (
          <Card padded className="p-5.5">
            <CardTitle>What they are looking for</CardTitle>
            <ul className="m-0 grid list-disc gap-2 pl-5">
              {job.requirements.map((item) => (
                <li key={item} className="text-sm leading-relaxed text-[#626d86]">
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <div className="grid content-start gap-4.5">
        <Card padded>
          <CardTitle>Skills</CardTitle>
          {job.requiredSkills.length > 0 && (
            <>
              <p className="m-0 mb-2 text-xs font-bold text-navy">Required</p>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {job.requiredSkills.map((s) => (
                  <SkillTag key={s}>{s}</SkillTag>
                ))}
              </div>
            </>
          )}
          {job.preferredSkills.length > 0 && (
            <>
              <p className="m-0 mb-2 text-xs font-bold text-navy">Nice to have</p>
              <div className="flex flex-wrap gap-1.5">
                {job.preferredSkills.map((s) => (
                  <SkillTag key={s}>{s}</SkillTag>
                ))}
              </div>
            </>
          )}
          {job.requiredSkills.length === 0 && job.preferredSkills.length === 0 && (
            <p className="m-0 text-[13px] text-muted">None listed.</p>
          )}
        </Card>

        <Card padded>
          <CardTitle>About {job.companyName}</CardTitle>
          <p className="m-0 text-[13px] leading-relaxed text-muted">
            {job.companyAbout ?? 'No company description yet.'}
          </p>
          <dl className="mt-4 grid gap-2 text-[13px]">
            {job.companyLocation && (
              <div className="flex justify-between gap-3 border-b border-line pb-2">
                <dt className="text-muted">Location</dt>
                <dd className="m-0 font-semibold">{job.companyLocation}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3 border-b border-line pb-2">
              <dt className="text-muted">Posted</dt>
              <dd className="m-0 font-semibold">{job.postedLabel}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Applicants</dt>
              <dd className="m-0 font-semibold">{job.applicantCount}</dd>
            </div>
          </dl>
        </Card>

        <Button href={backHref} variant="ghost">
          {backLabel}
        </Button>
      </div>
    </div>
  )
}
