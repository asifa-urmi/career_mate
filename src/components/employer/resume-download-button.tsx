'use client'

import { useTransition } from 'react'
import { Button, useToast } from '@/components/ui'
import { downloadApplicantResumeAction } from '@/app/(employer)/candidates/actions'

/**
 * Opens an applicant's CV in a new tab.
 *
 * The link is minted on demand and expires in two minutes, so it is never in
 * the page source and never in this tab's history. The service decides whether
 * this employer may have it at all, by checking the CV is attached to an
 * application to one of their own company's jobs.
 */
export function ResumeDownloadButton({
  resumeId,
  fileName,
}: {
  resumeId: string
  fileName: string
}) {
  const [pending, start] = useTransition()
  const { show } = useToast()

  return (
    <Button
      type="button"
      variant="soft"
      size="sm"
      className="mt-2.5 w-full"
      loading={pending}
      onClick={() =>
        start(async () => {
          const result = await downloadApplicantResumeAction(resumeId)
          if (result.error || !result.url) {
            show(result.error ?? 'Could not create a download link', 'error')
            return
          }
          window.open(result.url, '_blank', 'noopener,noreferrer')
        })
      }
    >
      Open {fileName.toLowerCase().endsWith('.pdf') ? 'PDF' : 'CV'}
    </Button>
  )
}
