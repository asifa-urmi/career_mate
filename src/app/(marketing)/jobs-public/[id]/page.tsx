import { Button } from '@/components/ui'
import { Footer, PublicNav } from '@/components/layout'
import { JobDetail } from '@/components/jobs/job-detail'

export const dynamic = 'force-dynamic'

export default async function PublicJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <>
      <PublicNav />
      <div className="mx-auto w-[min(1180px,calc(100%-32px))] py-10">
        <JobDetail
          jobId={id}
          backHref="/jobs-public"
          backLabel="← All jobs"
          cta={
            <>
              <Button href="/signup">Create an account to apply</Button>
              <Button href="/login" variant="ghost">
                Sign in
              </Button>
            </>
          }
        />
      </div>
      <Footer />
    </>
  )
}
