import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireGroup } from '@/lib/auth/require-group'
import { Button, Card, CardTitle } from '@/components/ui'
import { candidateProfileIdFor } from '@/lib/db/repositories/saved-job.repository'
import {
  findApplicationForJob,
  findApplyTarget,
} from '@/lib/db/repositories/application.repository'

export const metadata: Metadata = { title: 'Application sent — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function SubmittedPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireGroup('candidate')
  const { id } = await params

  const profileId = await candidateProfileIdFor(user.id)
  if (!profileId) notFound()

  // The confirmation is only shown to someone who actually has an application
  // for this job — it is not a page you can reach by typing the URL.
  const [application, job] = await Promise.all([
    findApplicationForJob(profileId, id),
    findApplyTarget(id),
  ])
  if (!application || !job) notFound()

  return (
    <div className="mx-auto grid w-[min(620px,100%)] gap-4.5 py-8">
      <Card padded className="p-7 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-mint-soft text-2xl text-mint-ink">
          ✓
        </span>
        <h1 className="mt-4 mb-2 font-display text-[28px] font-extrabold">Application sent</h1>
        <p className="m-0 text-sm leading-relaxed text-muted">
          {job.company.name} has your application for <b className="text-navy">{job.title}</b>.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          <Button href="/tracker">Track this application</Button>
          <Button href="/jobs" variant="ghost">
            Keep looking
          </Button>
        </div>
      </Card>

      <Card padded>
        <CardTitle>What happens next</CardTitle>
        <ol className="m-0 grid list-decimal gap-2 pl-5 text-[13px] leading-relaxed text-muted">
          <li>The hiring team reviews your profile, answers and CV.</li>
          <li>
            If they move you forward, the stage changes on your tracker and you get a
            notification.
          </li>
          <li>You can withdraw at any point from the tracker.</li>
        </ol>
      </Card>
    </div>
  )
}
