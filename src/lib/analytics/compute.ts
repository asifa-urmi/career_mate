import type { ApplicationStage } from '@prisma/client'
import { PIPELINE_STAGES, stageLabel } from '@/config/constants'

export type StageCounts = Record<ApplicationStage, number>
export type FunnelStage = { key: ApplicationStage; label: string; count: number }
export type DayBucket = { label: string; count: number }

/**
 * A hiring funnel from current-stage counts.
 *
 * An application row records where someone is now, not where they have been —
 * so somebody at OFFER is invisible at SCREENING even though they passed
 * through it. Counting raw stages draws a funnel that widens in the middle,
 * which is not a funnel. Each stage is therefore everyone who reached it *or
 * beyond*, which is what "how many got this far" actually means.
 *
 * REJECTED and WITHDRAWN are counted at the top: they entered the process and
 * left it, and excluding them would flatter the conversion rate.
 */
export function buildFunnel(counts: StageCounts): FunnelStage[] {
  const exits = counts.REJECTED + counts.WITHDRAWN

  return PIPELINE_STAGES.map((stage, index) => {
    const reached = PIPELINE_STAGES.slice(index).reduce((sum, later) => sum + counts[later], 0)

    return {
      key: stage,
      label: stageLabel(stage),
      // Only the entry stage carries the people who dropped out; adding them at
      // every level would make later stages wider than earlier ones.
      count: index === 0 ? reached + exits : reached,
    }
  })
}

/** A percentage of the top of the funnel, never NaN and never above 100. */
export function conversionRate(reached: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.round((reached / total) * 100))
}

/**
 * Events per day over a window, including the empty days.
 *
 * Skipping empty days would compress the chart's x-axis and make a quiet week
 * look like a busy one.
 */
export function bucketByDay(dates: Date[], days: number, now = new Date()): DayBucket[] {
  const buckets: DayBucket[] = []
  const counts = new Map<string, number>()

  for (const date of dates) {
    counts.set(dayKey(date), (counts.get(dayKey(date)) ?? 0) + 1)
  }

  for (let offset = days - 1; offset >= 0; offset--) {
    const day = new Date(now)
    day.setDate(day.getDate() - offset)
    const key = dayKey(day)

    buckets.push({
      label: day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      count: counts.get(key) ?? 0,
    })
  }

  return buckets
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Average gap in days, to one decimal.
 *
 * `null` when there is nothing to average, not zero: an inbox nobody has
 * touched has no response time, and reporting "0 days" would read as instant.
 */
export function averageDays(pairs: [start: Date, end: Date][]): number | null {
  const gaps = pairs
    .map(([start, end]) => end.getTime() - start.getTime())
    .filter((ms) => ms >= 0)

  if (gaps.length === 0) return null

  const averageMs = gaps.reduce((sum, ms) => sum + ms, 0) / gaps.length
  return Math.round((averageMs / 86_400_000) * 10) / 10
}
