'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button, useToast } from '@/components/ui'
import { startConversationAction } from '@/app/(candidate)/messages/actions'

/**
 * Opens (or reopens) the thread for one application.
 *
 * The service decides whether this employer may talk to this candidate, by
 * checking the application belongs to their company. This just asks.
 */
export function MessageCandidateButton({ applicationId }: { applicationId: string }) {
  const [pending, start] = useTransition()
  const router = useRouter()
  const { show } = useToast()

  return (
    <Button
      type="button"
      variant="soft"
      className="w-full"
      loading={pending}
      onClick={() =>
        start(async () => {
          const result = await startConversationAction(applicationId)
          if (result.error) {
            show(result.error, 'error')
            return
          }
          router.push('/employer/messages')
        })
      }
    >
      Message this candidate
    </Button>
  )
}
