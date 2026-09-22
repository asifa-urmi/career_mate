import { cn } from '@/lib/utils/cn'
import { clampScore } from '@/lib/utils/format'

/**
 * The prototype's conic-gradient match dial. `clampScore` guarantees the CSS
 * custom property is a usable number — an out-of-range or NaN score would make
 * the browser discard the gradient and render an empty circle with no clue why.
 */
export function ScoreRing({
  score,
  size = 54,
  className,
  label,
}: {
  score: number
  size?: number
  className?: string
  /** Screen-reader text. Defaults to describing the score as a match. */
  label?: string
}) {
  const value = clampScore(score)

  return (
    <div
      className={cn('score-ring shrink-0', className)}
      style={{ '--score': value, width: size, height: size } as React.CSSProperties}
      role="img"
      aria-label={label ?? `${value}% match`}
    >
      <b className="text-xs font-extrabold text-mint-ink">{value}%</b>
    </div>
  )
}

/** The larger blue dial used for CV review scores. */
export function ResumeScore({ score, caption }: { score: number; caption?: string }) {
  const value = clampScore(score)

  return (
    <div
      className="resume-score"
      style={{ '--score': value } as React.CSSProperties}
      role="img"
      aria-label={caption ?? `CV score ${value} out of 100`}
    >
      <strong className="text-3xl font-extrabold">{value}</strong>
    </div>
  )
}
