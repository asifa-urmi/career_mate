import { Button, Card } from '@/components/ui'
import { Brand } from '@/components/layout'

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-bg px-4">
      <Card padded className="w-full max-w-md text-center">
        <div className="mb-5 flex justify-center">
          <Brand />
        </div>
        <h1 className="m-0 font-display text-6xl font-extrabold text-navy">404</h1>
        <p className="mt-2 mb-6 text-sm leading-relaxed text-muted">
          That page does not exist. It may have been moved, or the job may have closed.
        </p>
        <div className="flex justify-center gap-2.5">
          <Button href="/">Go home</Button>
          <Button href="/jobs-public" variant="ghost">
            Browse jobs
          </Button>
        </div>
      </Card>
    </div>
  )
}
