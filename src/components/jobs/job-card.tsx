import Link from 'next/link'
import type { JobCardModel } from '@/lib/db/repositories/job.repository'
import { Badge, Card, CompanyMark, ScoreRing, SkillTag } from '@/components/ui'
import { categoryLabel } from '@/config/categories'
import { WORK_MODES } from '@/config/constants'

const WORK_MODE_LABEL = new Map(WORK_MODES.map((m) => [m.value, m.label]))

/**
 * One job in a list. Purely presentational — it takes an already-formatted
 * `JobCardModel` and renders it, with `href` deciding where the title links.
 * Public listings point at the marketing detail route, signed-in ones at the
 * candidate route.
 */
export function JobCard({
  job,
  href,
  action,
}: {
  job: JobCardModel
  href: string
  action?: React.ReactNode
}) {
  return (
    <Card className="p-4.5 transition-all hover:-translate-y-0.5 hover:border-[#ccd9ff] hover:shadow-[var(--shadow-card-sm)]">
      <div className="flex items-start gap-3.5">
        <CompanyMark
          initials={job.logoInitials}
          className="bg-[linear-gradient(145deg,#dce6ff,#eff3ff)] !text-blue"
        />

        <div className="min-w-0 flex-1">
          <h3 className="m-0 mb-1.5 text-base font-extrabold">
            <Link href={href} className="hover:text-blue">
              {job.title}
            </Link>
          </h3>

          <div className="flex flex-wrap gap-2.5 text-xs text-muted">
            <span className="font-semibold text-navy">{job.companyName}</span>
            <span>{categoryLabel(job.category)}</span>
            <span>{job.location}</span>
            <span>{WORK_MODE_LABEL.get(job.workMode)}</span>
            <span>{job.salaryLabel}</span>
          </div>

          {job.skills.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {job.skills.map((skill) => (
                <SkillTag key={skill}>{skill}</SkillTag>
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2.5 text-[11px] text-muted">
            <Badge tone="dark">{job.postedLabel}</Badge>
            <span>
              {job.applicantCount} {job.applicantCount === 1 ? 'applicant' : 'applicants'}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2.5">
          {job.score !== undefined && <ScoreRing score={job.score} />}
          {action}
        </div>
      </div>
    </Card>
  )
}

export function JobList({
  jobs,
  hrefFor,
  actionFor,
}: {
  jobs: readonly JobCardModel[]
  hrefFor: (job: JobCardModel) => string
  actionFor?: (job: JobCardModel) => React.ReactNode
}) {
  return (
    <ul className="grid list-none gap-3 p-0">
      {jobs.map((job) => (
        <li key={job.id}>
          <JobCard job={job} href={hrefFor(job)} action={actionFor?.(job)} />
        </li>
      ))}
    </ul>
  )
}
