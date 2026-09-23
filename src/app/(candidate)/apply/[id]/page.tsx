import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { requireGroup } from '@/lib/auth/require-group'
import { PageHead } from '@/components/layout'
import { ApplyWizard } from '@/components/applications/apply-wizard'
import { candidateProfileIdFor } from '@/lib/db/repositories/saved-job.repository'
import {
  findApplicationForJob,
  findApplyTarget,
} from '@/lib/db/repositories/application.repository'
import { listCandidateResumes } from '@/lib/db/repositories/resume.repository'
import { applyAction } from './actions'

export const metadata: Metadata = { title: 'Apply — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function ApplyPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireGroup('candidate')
  const { id } = await params

  const profileId = await candidateProfileIdFor(user.id)
  if (!profileId) redirect('/onboarding')

  const job = await findApplyTarget(id)
  // A draft, closed or unmoderated role is not found rather than forbidden.
  if (!job) notFound()

  // Someone who already applied is sent to the tracker rather than shown a form
  // whose submit is guaranteed to fail on the unique constraint.
  const existing = await findApplicationForJob(profileId, id)
  if (existing) redirect('/tracker')

  const resumes = await listCandidateResumes(profileId)

  return (
    <>
      <PageHead
        title={`Apply: ${job.title}`}
        description={`${job.company.name} · your answers and CV go straight to their hiring team.`}
      />
      <div className="mx-auto w-[min(760px,100%)]">
        <ApplyWizard
          jobId={job.id}
          jobTitle={job.title}
          companyName={job.company.name}
          screeningQuestions={job.screeningQuestions}
          resumes={resumes}
          action={applyAction}
        />
      </div>
    </>
  )
}
