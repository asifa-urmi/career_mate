import type { Metadata } from 'next'
import { requireGroup } from '@/lib/auth/require-group'
import { ComingSoon } from '@/components/layout/coming-soon'

export const metadata: Metadata = { title: 'CV & Resume — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireGroup('candidate')

  return (
    <ComingSoon
      title="CV &amp; Resume"
      description="Upload, version and review your CVs."
      phase="P2"
      does={[
        'Upload PDF or DOCX up to 10 MB, stored privately.',
        'Keep several versions and mark one as primary.',
        'Extracted text fills your profile so you do not type it twice.',
        'AI review suggests truthful improvements for a target role.',
      ]}
      backHref="/dashboard"
      backLabel="Back to dashboard"
    />
  )
}
