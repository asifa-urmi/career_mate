'use client'

import { useState, useTransition } from 'react'
import { Button, Card, CardTitle, ScoreRing } from '@/components/ui'
import { AiPanel } from './ai-panel'
import { explainMatchAction, type AiPanelState } from '@/app/(candidate)/ai-coach/actions'
import type { MatchExplanation } from '@/lib/ai/schemas'

export type MatchSummary = {
  score: number
  confidence: number
  dimensions: { key: string; label: string; score: number | null; evidence: string }[]
}

/**
 * The score and its breakdown are already on the page before any AI is asked.
 *
 * That ordering matters: the number is CareerMate's, computed from the profile
 * and the job, and it is true whether or not a provider answers. The AI adds a
 * reading of it. Someone who never presses the button still gets the substance.
 */
export function MatchExplainer({ jobId, match }: { jobId: string; match: MatchSummary }) {
  const [state, setState] = useState<AiPanelState<MatchExplanation>>({})
  const [pending, start] = useTransition()

  return (
    <Card padded>
      <CardTitle>Your match</CardTitle>

      <div className="mb-4 flex items-center gap-4">
        <ScoreRing score={match.score} size={64} />
        <div className="min-w-0">
          <p className="m-0 text-[13px] leading-relaxed text-muted">
            Calculated from your profile and this role — not by AI, so it does not change when a
            provider is busy.
          </p>
          {match.confidence < 0.99 && (
            <p className="m-0 mt-1 text-[11px] text-muted">
              Based on {Math.round(match.confidence * 100)}% of the picture — fill in more of your
              profile to sharpen it.
            </p>
          )}
        </div>
      </div>

      <dl className="m-0 grid gap-2">
        {match.dimensions.map((d) => (
          <div key={d.key} className="border-b border-line pb-2 last:border-0">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[13px] font-bold">{d.label}</dt>
              <dd className="m-0 text-[13px] font-extrabold text-navy">
                {d.score === null ? '—' : `${d.score}%`}
              </dd>
            </div>
            <p className="m-0 mt-0.5 text-xs leading-relaxed text-muted">{d.evidence}</p>
          </div>
        ))}
      </dl>

      <Button
        type="button"
        variant="soft"
        className="mt-4 w-full"
        loading={pending}
        onClick={() => start(async () => setState(await explainMatchAction(jobId)))}
      >
        {state.data ? 'Explain again' : 'Explain this in plain words'}
      </Button>

      {state.error && (
        <p role="alert" className="mt-3 mb-0 text-xs font-semibold text-danger">
          {state.error}
        </p>
      )}

      {state.data && (
        <AiPanel className="mt-4" providerLabel={state.providerLabel} usedFallback={state.usedFallback}>
          <p className="m-0 text-[13px] leading-relaxed">{state.data.summary}</p>

          {state.data.strengths.length > 0 && (
            <>
              <b className="mt-3 mb-1 block text-xs text-mint-ink">In your favour</b>
              <ul className="m-0 grid list-disc gap-1 pl-4">
                {state.data.strengths.map((s, i) => (
                  <li key={i} className="text-[13px] leading-relaxed">
                    {s}
                  </li>
                ))}
              </ul>
            </>
          )}

          {state.data.gaps.length > 0 && (
            <>
              <b className="mt-3 mb-1 block text-xs text-[#a16b0d]">Worth addressing</b>
              <ul className="m-0 grid list-disc gap-1 pl-4">
                {state.data.gaps.map((g, i) => (
                  <li key={i} className="text-[13px] leading-relaxed">
                    {g}
                  </li>
                ))}
              </ul>
            </>
          )}
        </AiPanel>
      )}
    </Card>
  )
}
