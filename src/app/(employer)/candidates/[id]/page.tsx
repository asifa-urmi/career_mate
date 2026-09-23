import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireGroup } from '@/lib/auth/require-group'
import { PageHead } from '@/components/layout'
import { Avatar, Badge, Button, Card, CardTitle, SkillTag, StatusChip } from '@/components/ui'
import { StageControl } from '@/components/employer/stage-control'
import { MessageCandidateButton } from '@/components/employer/message-candidate-button'
import { ResumeDownloadButton } from '@/components/employer/resume-download-button'
import { categoryLabel } from '@/config/categories'
import { EXPERIENCE_LEVELS, stageLabel } from '@/config/constants'
import { relativeTime } from '@/lib/utils/format'
import {
  companyIdForUser,
  findCompanyApplication,
} from '@/lib/db/repositories/employer.repository'
import { toScreeningAnswers } from '@/lib/db/repositories/application.repository'

export const metadata: Metadata = { title: 'Candidate — CareerMate' }
export const dynamic = 'force-dynamic'

const LEVEL_LABEL = new Map(EXPERIENCE_LEVELS.map((l) => [l.value, l.label]))

function period(start: Date, end: Date | null, isCurrent: boolean): string {
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
  return `${fmt(start)} — ${isCurrent ? 'Present' : end ? fmt(end) : 'Present'}`
}

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireGroup('employer')
  const { id } = await params

  const companyId = await companyIdForUser(user.id)
  if (!companyId) notFound()

  // Scoped to the company in the where clause: another company's applicant is
  // not found rather than read and then refused.
  const application = await findCompanyApplication(companyId, id)
  if (!application) notFound()

  const candidate = application.candidateProfile
  // Read from the application, not the job: the questions can be edited after
  // someone applies, and re-pairing their answers would have the employer
  // screening on evidence the candidate never gave.
  const screening = toScreeningAnswers(application.screeningAnswers)
  const now = new Date()

  return (
    <>
      <PageHead
        title={candidate.user.name}
        description={`Applied for ${application.job.title} · ${relativeTime(application.createdAt, now)}`}
        actions={
          <Button href="/candidates" variant="ghost">
            Back to candidates
          </Button>
        }
      />

      <div className="grid gap-4.5 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-4.5">
          <Card padded>
            <div className="flex flex-wrap items-start gap-4">
              <Avatar name={candidate.user.name} size={64} />
              <div className="min-w-0 flex-1">
                <h2 className="m-0 mb-1 font-display text-xl font-extrabold">
                  {candidate.user.name}
                </h2>
                <p className="m-0 text-sm text-muted">{candidate.headline ?? 'No headline yet'}</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Badge tone="dark">{categoryLabel(candidate.primarySector)}</Badge>
                  <Badge tone="dark">
                    {LEVEL_LABEL.get(candidate.experienceLevel) ?? candidate.experienceLevel}
                  </Badge>
                  {candidate.location && <Badge tone="dark">{candidate.location}</Badge>}
                </div>
              </div>
            </div>
            {candidate.bio && (
              <p className="mt-4 mb-0 text-sm leading-relaxed text-[#626d86]">{candidate.bio}</p>
            )}
          </Card>

          {screening.length > 0 && (
            <Card padded>
              <CardTitle>Screening answers</CardTitle>
              <p className="m-0 mb-3 text-xs text-muted">
                The questions as they were when this person applied.
              </p>
              <dl className="m-0 grid gap-2.5">
                {screening.map((entry, i) => (
                  <div key={i} className="rounded-[10px] border border-line p-3.5">
                    <dt className="text-[13px] font-bold">{entry.question}</dt>
                    <dd className="m-0 mt-1.5 text-[13px] leading-relaxed text-[#626d86]">
                      {entry.answer || <span className="text-muted">Not answered</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}

          {application.coverLetter && (
            <Card padded>
              <CardTitle>Cover letter</CardTitle>
              <p className="m-0 text-sm leading-relaxed whitespace-pre-wrap text-[#626d86]">
                {application.coverLetter}
              </p>
            </Card>
          )}

          {candidate.experiences.length > 0 && (
            <Card padded>
              <CardTitle>Experience</CardTitle>
              <ul className="m-0 grid list-none gap-3.5 p-0">
                {candidate.experiences.map((e) => (
                  <li key={e.id} className="border-l-2 border-line pl-3.5">
                    <b className="block text-sm">{e.title}</b>
                    <span className="block text-[13px] text-muted">{e.company}</span>
                    <span className="block text-[11px] text-muted">
                      {period(e.startDate, e.endDate, e.isCurrent)}
                    </span>
                    {e.description && (
                      <p className="m-0 mt-1.5 text-[13px] leading-relaxed text-[#626d86]">
                        {e.description}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {candidate.educations.length > 0 && (
            <Card padded>
              <CardTitle>Education</CardTitle>
              <ul className="m-0 grid list-none gap-2.5 p-0">
                {candidate.educations.map((e) => (
                  <li key={e.id} className="border-l-2 border-line pl-3.5">
                    <b className="block text-sm">{e.degree}</b>
                    <span className="block text-[13px] text-muted">{e.institution}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="grid content-start gap-4.5">
          <Card padded>
            <CardTitle>Stage</CardTitle>
            <div className="mb-3">
              <StatusChip stage={application.stage} />
            </div>
            <StageControl applicationId={application.id} stage={application.stage} />
            <div className="mt-3 border-t border-line pt-3">
              <MessageCandidateButton applicationId={application.id} />
            </div>
          </Card>

          <Card padded>
            <CardTitle>CV</CardTitle>
            {application.resume ? (
              <>
                <p className="m-0 text-[13px] leading-relaxed text-muted">
                  <b className="text-navy">{application.resume.label}</b>
                  <br />
                  {application.resume.fileName}
                </p>
                <ResumeDownloadButton
                  resumeId={application.resume.id}
                  fileName={application.resume.fileName}
                />
                <p className="m-0 mt-2 text-xs leading-relaxed text-muted">
                  The link expires in two minutes and is not stored anywhere.
                </p>
              </>
            ) : (
              <p className="m-0 text-[13px] leading-relaxed text-muted">
                This application has no CV attached — judge it on the profile and the answers
                here.
              </p>
            )}
          </Card>

          {candidate.skills.length > 0 && (
            <Card padded>
              <CardTitle>Skills</CardTitle>
              <div className="flex flex-wrap gap-1.5">
                {candidate.skills.map((s) => (
                  <SkillTag key={s.name}>{s.name}</SkillTag>
                ))}
              </div>
            </Card>
          )}

          <Card padded>
            <CardTitle>History</CardTitle>
            <ol className="m-0 grid list-none gap-2.5 p-0">
              {application.events.map((e) => (
                <li key={e.id} className="flex items-start gap-2.5">
                  <span
                    className="mt-1.5 size-2 shrink-0 rounded-full bg-mint"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <b className="block text-[13px]">
                      {e.fromStage
                        ? `${stageLabel(e.fromStage)} → ${stageLabel(e.toStage)}`
                        : stageLabel(e.toStage)}
                    </b>
                    <span className="block text-[11px] text-muted">
                      {relativeTime(e.createdAt, now)}
                    </span>
                    {e.note && (
                      <p className="m-0 mt-1 text-[13px] leading-relaxed text-muted">{e.note}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  )
}
