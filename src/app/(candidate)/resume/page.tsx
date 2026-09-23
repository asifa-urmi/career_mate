import type { Metadata } from 'next'
import { requireGroup } from '@/lib/auth/require-group'
import { PageHead } from '@/components/layout'
import { ResumeManager } from '@/components/resume/resume-manager'
import { candidateProfileIdFor } from '@/lib/db/repositories/saved-job.repository'
import { listCandidateResumeDetails } from '@/lib/db/repositories/resume.repository'

export const metadata: Metadata = { title: 'CV & Resume — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function ResumePage() {
  const user = await requireGroup('candidate')
  const profileId = await candidateProfileIdFor(user.id)
  const resumes = profileId ? await listCandidateResumeDetails(profileId) : []

  return (
    <>
      <PageHead
        title="CV & Resume"
        description="Keep several versions and choose which one goes with each application."
      />
      <ResumeManager resumes={resumes} />
    </>
  )
}
