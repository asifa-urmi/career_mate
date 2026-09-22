import { Badge } from '@/components/ui'
import { Brand } from '@/components/layout'

/**
 * The split auth screen: navy story panel on the left, form card on the right.
 * The panel collapses away below lg rather than stacking, because on a phone it
 * is three screens of scrolling before the form.
 */
export function AuthShell({
  eyebrow,
  headline,
  body,
  proof,
  children,
}: {
  eyebrow: string
  headline: string
  body: string
  proof: readonly string[]
  children: React.ReactNode
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1fr]">
      <div className="hidden flex-col justify-between bg-navy p-10 text-white lg:flex">
        <Brand onDark />

        <div className="max-w-md">
          <Badge tone="mint">{eyebrow}</Badge>
          <h2 className="mt-4 mb-3 font-display text-[34px] leading-[1.15] font-extrabold">
            {headline}
          </h2>
          <p className="m-0 text-[15px] leading-relaxed text-[#aebbd9]">{body}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {proof.map((p) => (
            <span key={p} className="rounded-full bg-white/8 px-3 py-2 text-xs font-semibold">
              {p}
            </span>
          ))}
        </div>
      </div>

      <div className="grid place-items-center px-4 py-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-6 lg:hidden">
            <Brand />
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
