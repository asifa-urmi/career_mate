import { cn } from '@/lib/utils/cn'
import { clampScore, initials as toInitials } from '@/lib/utils/format'

/** Brand-gradient meter. */
export function Progress({
  value,
  className,
  label,
}: {
  value: number
  className?: string
  label?: string
}) {
  const pct = clampScore(value)
  return (
    <div
      className={cn('h-2 overflow-hidden rounded-full bg-[#e9edf5]', className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <span className="progress-fill block h-full rounded-full" style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Avatar({
  name,
  size = 38,
  className,
}: {
  name: string
  size?: number
  className?: string
}) {
  return (
    <span
      className={cn(
        'avatar-gradient grid shrink-0 place-items-center rounded-full font-extrabold text-white',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size / 2.7) }}
      aria-hidden="true"
    >
      {toInitials(name)}
    </span>
  )
}

/** Square company monogram, as on the prototype's job cards. */
export function CompanyMark({
  initials,
  size = 44,
  className,
}: {
  initials: string
  size?: number
  className?: string
}) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-[10px] bg-navy font-extrabold text-white',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size / 3) }}
      aria-hidden="true"
    >
      {initials}
    </span>
  )
}

export function SkillTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-lg bg-[#f0f3f9] px-2 py-1.5 text-[11px] font-bold text-[#556078]">
      {children}
    </span>
  )
}

/**
 * Shown wherever there is genuinely nothing yet. Used instead of fabricated
 * numbers: a brand-new account's dashboard has zero applications, and saying so
 * is more useful than showing a made-up figure.
 */
export function EmptyState({
  glyph = '◌',
  title,
  body,
  action,
  className,
}: {
  glyph?: string
  title: string
  body?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('grid place-items-center gap-2 px-6 py-12 text-center', className)}>
      <span className="text-4xl text-muted/50" aria-hidden="true">
        {glyph}
      </span>
      <b className="font-display text-base">{title}</b>
      {body && <p className="m-0 max-w-sm text-[13px] leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function MetricCard({
  label,
  value,
  trend,
  className,
}: {
  label: string
  value: string | number
  trend?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] border border-line bg-surface p-[18px] shadow-[var(--shadow-card-sm)]',
        className,
      )}
    >
      <small className="font-semibold text-muted">{label}</small>
      <strong className="mt-2 mb-1 block font-display text-[28px] leading-none">{value}</strong>
      {trend && <span className="text-xs text-[#1a8c72]">{trend}</span>}
    </div>
  )
}

export function Stepper({ steps, current }: { steps: readonly string[]; current: number }) {
  return (
    <ol className="my-8 flex items-center justify-center gap-0" aria-label="Progress">
      {steps.map((step, i) => {
        const n = i + 1
        const done = n < current
        const active = n === current
        return (
          <li key={step} className="flex items-center">
            {i > 0 && <span className="step-line" data-done={n <= current} aria-hidden="true" />}
            <span
              className={cn(
                'grid size-[34px] place-items-center rounded-full text-xs font-extrabold',
                done && 'bg-mint text-white',
                active && 'bg-blue text-white',
                !done && !active && 'bg-[#e3e8f2] text-[#7f899e]',
              )}
              aria-current={active ? 'step' : undefined}
            >
              <span className="sr-only">{step}</span>
              <span aria-hidden="true">{done ? '✓' : n}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/** The prototype's mint-bordered guardrail note. */
export function Suggestion({ children }: { children: React.ReactNode }) {
  return (
    <div className="suggestion my-2.5 rounded-lg p-3 text-xs leading-relaxed">{children}</div>
  )
}
