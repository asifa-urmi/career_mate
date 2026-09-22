import { cn } from '@/lib/utils/cn'

/**
 * The surface every panel sits on. Deliberately not polymorphic: a list of cards
 * wraps each one in its own `<li>` rather than making the card become a list
 * item, which keeps the element-type plumbing out of a purely visual component.
 */
export function Card({
  className,
  padded = false,
  id,
  children,
}: {
  className?: string
  padded?: boolean
  id?: string
  children: React.ReactNode
}) {
  return (
    <div
      id={id}
      className={cn(
        'rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card-sm)]',
        padded && 'p-5',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardTitle({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <h3 className={cn('m-0 mb-3.5 text-base font-extrabold', className)}>{children}</h3>
}
