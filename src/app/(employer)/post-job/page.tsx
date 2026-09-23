import type { Metadata } from 'next'
import { requireGroup } from '@/lib/auth/require-group'
import { PageHead } from '@/components/layout'
import { Button, Suggestion } from '@/components/ui'
import { JobForm } from '@/components/employer/job-form'
import { createJobAction } from './actions'

export const metadata: Metadata = { title: 'Post a job — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function PostJobPage() {
  await requireGroup('employer')

  return (
    <>
      <PageHead
        title="Post a job"
        description="Any sector. Saved as a draft first — you publish it when you are ready."
        actions={
          <Button href="/manage-jobs" variant="ghost">
            Back to jobs
          </Button>
        }
      />

      <div className="mx-auto w-[min(860px,100%)]">
        <Suggestion>
          Jobs are saved as drafts and go to moderation before appearing on the public board.
          Nothing is visible to candidates until it is approved.
        </Suggestion>
        <div className="mt-4">
          <JobForm action={createJobAction} submitLabel="Save draft" />
        </div>
      </div>
    </>
  )
}
