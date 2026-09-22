import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

export type ButtonVariant = 'primary' | 'dark' | 'soft' | 'ghost' | 'mint' | 'danger'
export type ButtonSize = 'sm' | 'md'

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-blue text-white shadow-[var(--shadow-primary)] hover:bg-blue-ink',
  dark: 'bg-navy text-white hover:bg-navy-2',
  soft: 'bg-blue-wash text-blue hover:bg-[#e2ebff]',
  ghost: 'bg-transparent text-navy border border-line hover:bg-white',
  mint: 'bg-mint text-[#06382f] hover:brightness-95',
  danger: 'bg-danger text-white hover:brightness-95',
}

const SIZE: Record<ButtonSize, string> = {
  sm: 'px-3.5 py-2 text-[13px]',
  md: 'px-[18px] py-3 text-sm',
}

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-field)] font-bold ' +
  'transition-all duration-200 hover:-translate-y-px disabled:pointer-events-none ' +
  'disabled:opacity-55 disabled:translate-y-0'

type CommonProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  children: React.ReactNode
}

type ButtonAsButton = CommonProps &
  Omit<React.ComponentPropsWithoutRef<'button'>, 'className' | 'children'> & {
    href?: undefined
    loading?: boolean
  }

type ButtonAsLink = CommonProps &
  Omit<React.ComponentPropsWithoutRef<typeof Link>, 'className' | 'children' | 'href'> & {
    href: React.ComponentProps<typeof Link>['href']
  }

/**
 * Renders an anchor when given `href` and a button otherwise, so navigation is
 * always a real link — right-clickable, middle-clickable, and readable by a
 * screen reader as a link rather than a button that happens to navigate. The
 * prototype used `onclick="go(...)"` everywhere, which was none of those things.
 */
export function Button(props: ButtonAsButton | ButtonAsLink) {
  const { variant = 'primary', size = 'md', className, children } = props

  const classes = cn(BASE, VARIANT[variant], SIZE[size], className)

  if (props.href !== undefined) {
    const { variant: _v, size: _s, className: _c, children: _ch, ...rest } = props
    return (
      <Link {...rest} className={classes}>
        {children}
      </Link>
    )
  }

  const { variant: _v, size: _s, className: _c, children: _ch, loading, ...rest } = props
  return (
    <button {...rest} className={classes} disabled={rest.disabled ?? loading}>
      {loading ? 'Working…' : children}
    </button>
  )
}
