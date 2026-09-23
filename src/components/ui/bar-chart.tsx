import { cn } from '@/lib/utils/cn'

export type BarDatum = { label: string; value: number }

/**
 * The prototype's CSS-only bar chart. No charting library: five bars whose
 * heights are percentages of the largest value, which is all the analytics
 * screens need and ships no extra JavaScript.
 *
 * Rendered as a definition list so the numbers are readable without the visual —
 * the prototype's version was bare divs and conveyed nothing to a screen reader.
 */
export function BarChart({
  data,
  className,
  caption,
}: {
  data: readonly BarDatum[]
  className?: string
  caption?: string
}) {
  const max = Math.max(1, ...data.map((d) => d.value))

  return (
    <figure className={cn('m-0', className)}>
      <div className="flex h-[220px] items-end gap-2.5 border-b border-line px-2 pt-[18px] pb-1">
        {data.map((d) => (
          <div key={d.label} className="flex h-full min-w-5 flex-1 flex-col justify-end">
            <span
              className="bar w-full"
              style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }}
              aria-hidden="true"
            />
          </div>
        ))}
      </div>

      <div className="mt-2 flex gap-2.5 px-2">
        {data.map((d) => (
          <div key={d.label} className="flex-1 text-center text-[11px] text-muted">
            {d.label}
          </div>
        ))}
      </div>

      <figcaption className="sr-only">
        {caption ? `${caption}. ` : ''}
        {data.map((d) => `${d.label}: ${d.value}`).join('. ')}
      </figcaption>
    </figure>
  )
}
