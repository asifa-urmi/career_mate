import { cn } from '@/lib/utils/cn'

export type BadgeTone = 'blue' | 'mint' | 'dark' | 'warn' | 'danger'

const TONE: Record<BadgeTone, string> = {
  blue: 'bg-blue-wash text-blue',
  mint: 'bg-mint-soft text-mint-ink',
  dark: 'bg-[#e9edf7] text-navy',
  warn: 'bg-[#fff4df] text-[#8b5f10]',
  danger: 'bg-[#fff0f3] text-[#b83c51]',
}

export function Badge({
  tone = 'blue',
  dot = false,
  className,
  children,
}: {
  tone?: BadgeTone
  /** The mint pulse dot from the prototype's hero badge. */
  dot?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-[7px] text-xs font-extrabold',
        TONE[tone],
        className,
      )}
    >
      {dot && <span className="pulse-dot inline-block size-2 rounded-full bg-mint" />}
      {children}
    </span>
  )
}

export function Kicker({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn('text-xs font-extrabold uppercase tracking-[0.13em] text-blue', className)}
    >
      {children}
    </span>
  )
}
