import { Badge } from '@/components/ui'
import { cn } from '@/lib/utils/cn'

/**
 * Wraps every AI answer, and says where it came from.
 *
 * Naming the provider is not decoration: when a free tier runs out the answer
 * changes source, and a person comparing two answers deserves to know why. When
 * the fallback served it, that is stated plainly rather than dressed up — an
 * answer nobody generated must not read like one that was.
 */
export function AiPanel({
  providerLabel,
  usedFallback,
  className,
  children,
}: {
  providerLabel?: string | undefined
  usedFallback?: boolean | undefined
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-[14px] border p-4',
        usedFallback ? 'border-[#f0d9a8] bg-[#fffaf0]' : 'border-line bg-[#f7f9ff]',
        className,
      )}
    >
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <span className="text-sm text-blue" aria-hidden="true">
          ✦
        </span>
        {usedFallback ? (
          <Badge tone="warn">Not AI-generated</Badge>
        ) : (
          <Badge tone="mint">AI</Badge>
        )}
        {providerLabel && (
          <span className="text-[11px] text-muted">
            {usedFallback ? providerLabel : `via ${providerLabel}`}
          </span>
        )}
      </div>

      {children}

      {usedFallback && (
        <p className="m-0 mt-3 text-[11px] leading-relaxed text-[#8b5f10]">
          Every configured AI provider is rate limited or out of quota, so this is a fixed
          message rather than a generated answer. Nothing here was written by a model.
        </p>
      )}
    </div>
  )
}
