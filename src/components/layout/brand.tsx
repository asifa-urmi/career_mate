import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

/**
 * The wordmark. The mark is a blue-to-navy rounded square with a mint disc
 * bleeding off its top-right corner — ported from the prototype's
 * `.brand-mark::after`.
 */
export function Brand({
  href = '/',
  onDark = false,
  className,
}: {
  href?: string
  onDark?: boolean
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2.5 font-display text-[21px] font-extrabold',
        onDark ? 'text-white' : 'text-navy',
        className,
      )}
    >
      <span className="relative grid size-[38px] shrink-0 place-items-center overflow-hidden rounded-[12px] bg-[linear-gradient(145deg,var(--color-blue),var(--color-navy))] text-white">
        <span
          className="absolute -top-2 -right-2.5 size-[22px] rounded-full bg-mint opacity-90"
          aria-hidden="true"
        />
        <span className="relative">C</span>
      </span>
      <span>CareerMate</span>
    </Link>
  )
}
