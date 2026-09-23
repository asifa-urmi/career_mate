import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireGroup } from '@/lib/auth/require-group'
import { PageHead } from '@/components/layout'
import { Button } from '@/components/ui'
import { JobForm } from '@/components/employer/job-form'
import { companyIdForUser, findCompanyJob } from '@/lib/db/repositories/employer.repository'
import { updateJobAction } from '../../post-job/actions'

export const metadata: Metadata = { title: 'Edit job — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireGroup('employer')
  const { id } = await params

  const companyId = await companyIdForUser(user.id)
  if (!companyId) notFound()

  // Scoped to the company in the where clause — another company's job is not
  // found rather than fetched and refused.
  const job = await findCompanyJob(companyId, id)
  if (!job) notFound()

  return (
    <>
      <PageHead
        title={`Edit: ${job.title}`}
        description="Changes apply immediately. Editing does not take a live job off the board."
        actions={
          <Button href="/manage-jobs" variant="ghost">
            Back to jobs
          </Button>
        }
      />

      <div className="mx-auto w-[min(860px,100%)]">
        <JobForm
          action={updateJobAction.bind(null, job.id)}
          submitLabel="Save changes"
          values={{
            title: job.title,
            category: job.category,
            location: job.location,
            workMode: job.workMode,
            jobType: job.jobType,
            salaryMinBdt: job.salaryMinBdt?.toString() ?? '',
            salaryMaxBdt: job.salaryMaxBdt?.toString() ?? '',
            salaryNote: job.salaryNote ?? '',
            summary: job.summary,
            responsibilities: job.responsibilities.join('\n'),
            requirements: job.requirements.join('\n'),
            requiredSkills: job.requiredSkills.join(', '),
            preferredSkills: job.preferredSkills.join(', '),
            screeningQuestions: job.screeningQuestions.join('\n'),
          }}
        />
      </div>
    </>
  )
}
