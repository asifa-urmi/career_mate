'use client'

import { useState, useTransition } from 'react'
import { useToast } from '@/components/ui'
import { cn } from '@/lib/utils/cn'
import { toggleSavedJobAction } from '@/app/(candidate)/saved/actions'

/**
 * Optimistic, but honest: the heart fills immediately and reverts if the server
 * refuses, with the reason in a toast. A save that silently failed would leave
 * someone believing a role was on their list.
 */
export function SaveButton({
  jobId,
  saved: initiallySaved,
  label = true,
}: {
  jobId: string
  saved: boolean
  label?: boolean
}) {
  const [saved, setSaved] = useState(initiallySaved)
  const [pending, startTransition] = useTransition()
  const { show } = useToast()

  function toggle() {
    const next = !saved
    setSaved(next)

    startTransition(async () => {
      const result = await toggleSavedJobAction(jobId)
      if ('error' in result) {
        setSaved(!next)
        show(result.error, 'error')
        return
      }
      setSaved(result.saved)
      show(result.saved ? 'Saved' : 'Removed from saved jobs')
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={saved}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[10px] border px-2.5 py-2 text-xs font-bold transition-colors',
        saved
          ? 'border-[#c9d8ff] bg-blue-wash text-blue'
          : 'border-line bg-surface text-[#58617a] hover:border-[#cbd8ff]',
        pending && 'opacity-60',
      )}
    >
      <span aria-hidden="true">{saved ? '♥' : '♡'}</span>
      {label && <span>{saved ? 'Saved' : 'Save'}</span>}
      <span className="sr-only">{saved ? `Remove from saved jobs` : `Save this job`}</span>
    </button>
  )
}
