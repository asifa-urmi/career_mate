import { Button, Card, EmptyState } from '@/components/ui'
import { PageHead } from './page-head'

/**
 * A destination that exists but is not built yet.
 *
 * The sidebar offers it, so it must respond — a nav link that 404s makes the
 * whole workspace feel broken. This says plainly what the page will do and which
 * phase brings it, instead of faking a screen with invented data.
 */
export function ComingSoon({
  title,
  description,
  phase,
  does,
  backHref,
  backLabel,
}: {
  title: string
  description: string
  phase: string
  does: readonly string[]
  backHref: string
  backLabel: string
}) {
  return (
    <>
      <PageHead title={title} description={description} />

      <Card padded>
        <EmptyState
          glyph="◷"
          title={`Arriving in ${phase}`}
          body="This page is part of the plan but is not built yet. Here is what it will do."
        />

        <ul className="mx-auto grid max-w-md list-none gap-2 p-0">
          {does.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2.5 rounded-[10px] border border-line px-3.5 py-2.5 text-[13px] leading-relaxed"
            >
              <span className="text-mint" aria-hidden="true">
                ✓
              </span>
              {item}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex justify-center">
          <Button href={backHref} variant="ghost">
            {backLabel}
          </Button>
        </div>
      </Card>
    </>
  )
}
