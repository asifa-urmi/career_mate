'use client'

import { useEffect } from 'react'
import { Button, Card } from '@/components/ui'
import { Brand } from '@/components/layout'

/**
 * Catches anything unexpected. Expected failures never reach here — services
 * return them as `Result` values and pages render them in place.
 *
 * The message is deliberately not the error's own text: that can carry a
 * connection string or a stack path. The digest is what links a report back to
 * the server log.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Unhandled error', error)
  }, [error])

  return (
    <div className="grid min-h-screen place-items-center bg-bg px-4">
      <Card padded className="w-full max-w-md text-center">
        <div className="mb-5 flex justify-center">
          <Brand />
        </div>
        <h1 className="m-0 mb-2 font-display text-2xl font-extrabold">Something went wrong</h1>
        <p className="m-0 mb-6 text-sm leading-relaxed text-muted">
          This page failed to load. Trying again often fixes it — if it keeps happening, the
          reference below will help us find the cause.
        </p>
        <div className="flex justify-center gap-2.5">
          <Button onClick={reset}>Try again</Button>
          <Button href="/" variant="ghost">
            Go home
          </Button>
        </div>
        {error.digest && (
          <p className="mt-5 mb-0 font-mono text-[11px] text-muted">Reference: {error.digest}</p>
        )}
      </Card>
    </div>
  )
}
