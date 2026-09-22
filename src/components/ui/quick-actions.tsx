import Link from 'next/link'
import { textGlyph } from '@/lib/utils/glyph'

export type QuickAction = {
  href: string
  glyph: string
  title: string
  subtitle: string
}

export function QuickActions({ items }: { items: readonly QuickAction[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="rounded-[14px] border border-line bg-surface p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[#cbd8ff]"
        >
          <span className="text-xl" aria-hidden="true">
            {textGlyph(item.glyph)}
          </span>
          <strong className="mt-2.5 block text-sm">{item.title}</strong>
          <span className="text-xs text-muted">{item.subtitle}</span>
        </Link>
      ))}
    </div>
  )
}

/** The prototype's gradient AI panel. */
export function AiBanner({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <div className="ai-banner p-5.5">
      <b className="font-display text-lg">{title}</b>
      <p className="m-0 mt-1.5 max-w-[620px] text-[13px] leading-relaxed text-[#cbd5ee]">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
