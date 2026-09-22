import type { ApplicationStage } from '@prisma/client'
import { cn } from '@/lib/utils/cn'
import { STAGE_TONE, stageLabel, type StageTone } from '@/config/constants'

const TONE: Record<StageTone, string> = {
  applied: 'bg-blue-wash text-blue',
  interview: 'bg-[#fff2db] text-[#a16b0d]',
  offer: 'bg-mint-soft text-mint-ink',
  reject: 'bg-[#fff0f3] text-[#b83c51]',
}

export function StatusChip({
  stage,
  className,
}: {
  stage: ApplicationStage
  className?: string
}) {
  return (
    <span
      className={cn(
        'w-max rounded-full px-2.5 py-1.5 text-[11px] font-extrabold',
        TONE[STAGE_TONE[stage]],
        className,
      )}
    >
      {stageLabel(stage)}
    </span>
  )
}
