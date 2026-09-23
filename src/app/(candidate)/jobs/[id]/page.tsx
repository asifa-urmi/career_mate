import { Button } from '@/components/ui'
import { requireGroup } from '@/lib/auth/require-group'
import { JobDetail } from '@/components/jobs/job-detail'

export const dynamic = 'force-dynamic'

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireGroup('candidate')
  const { id } = await params

  return (
    <JobDetail
      jobId={id}
      backHref="/jobs"
      backLabel="← All jobs"
      cta={
        <Button href="/jobs" variant="ghost">
          Applying arrives in the next phase
        </Button>
      }
    />
  )
}
