'use client'

import { useState, useTransition } from 'react'
import { Button, Card, CardTitle, Select, Suggestion, Textarea } from '@/components/ui'
import { AiPanel } from './ai-panel'
import {
  askCoachAction,
  coverLetterAction,
  interviewPrepAction,
  type AiPanelState,
} from '@/app/(candidate)/ai-coach/actions'
import type { CoachReply, CoverLetter, InterviewQuestions } from '@/lib/ai/schemas'

export type CoachJobOption = { id: string; label: string }

const PROMPTS = [
  'What should I do first to get more interviews?',
  'Which of my skills is worth putting first?',
  'How do I explain a gap in my work history?',
  'What should I ask at the end of an interview?',
]

export function AiCoach({ jobs }: { jobs: CoachJobOption[] }) {
  const [question, setQuestion] = useState('')
  const [reply, setReply] = useState<AiPanelState<CoachReply>>({})
  const [asking, startAsk] = useTransition()

  const [jobId, setJobId] = useState(jobs[0]?.id ?? '')
  const [letter, setLetter] = useState<AiPanelState<CoverLetter>>({})
  const [prep, setPrep] = useState<AiPanelState<InterviewQuestions>>({})
  const [working, startWork] = useTransition()

  function ask(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    setQuestion(trimmed)
    startAsk(async () => setReply(await askCoachAction(trimmed)))
  }

  return (
    <div className="grid gap-4.5 lg:grid-cols-[1fr_340px]">
      <Card padded>
        <CardTitle>Ask about your job search</CardTitle>
        <p className="m-0 mb-4 text-[13px] leading-relaxed text-muted">
          Answers are based on your own profile — your skills, history and preferences. Nothing
          about anyone else is used, and nothing you have not entered is assumed.
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          {PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={asking}
              onClick={() => ask(prompt)}
              className="rounded-full border border-[#ced9f3] bg-surface px-3 py-2 text-[11px] font-bold text-[#53607d] transition-colors hover:border-blue disabled:opacity-60"
            >
              {prompt}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            ask(question)
          }}
          className="grid gap-2.5"
        >
          <label htmlFor="coach-question" className="sr-only">
            Your question
          </label>
          <Textarea
            id="coach-question"
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask anything about your job search…"
            maxLength={2000}
          />
          <div className="flex justify-end">
            <Button type="submit" loading={asking} disabled={!question.trim()}>
              Ask
            </Button>
          </div>
        </form>

        {reply.error && (
          <p role="alert" className="mt-3 mb-0 text-xs font-semibold text-danger">
            {reply.error}
          </p>
        )}

        {reply.data && (
          <AiPanel
            className="mt-4"
            providerLabel={reply.providerLabel}
            usedFallback={reply.usedFallback}
          >
            <p className="m-0 text-[13px] leading-relaxed whitespace-pre-wrap">
              {reply.data.reply}
            </p>
          </AiPanel>
        )}
      </Card>

      <div className="grid content-start gap-4.5">
        <Card padded>
          <CardTitle>For a specific role</CardTitle>

          {jobs.length === 0 ? (
            <p className="m-0 text-[13px] leading-relaxed text-muted">
              Save or apply to a role and it appears here for cover letters and interview
              practice.
            </p>
          ) : (
            <>
              <label htmlFor="coach-job" className="sr-only">
                Choose a role
              </label>
              <Select
                id="coach-job"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                options={jobs.map((j) => ({ value: j.id, label: j.label }))}
                disabled={working}
              />

              <div className="mt-3 grid gap-2">
                <Button
                  type="button"
                  variant="soft"
                  loading={working}
                  onClick={() =>
                    startWork(async () => {
                      setPrep({})
                      setLetter(await coverLetterAction(jobId))
                    })
                  }
                >
                  Draft a cover letter
                </Button>
                <Button
                  type="button"
                  variant="soft"
                  loading={working}
                  onClick={() =>
                    startWork(async () => {
                      setLetter({})
                      setPrep(await interviewPrepAction(jobId))
                    })
                  }
                >
                  Practise the interview
                </Button>
              </div>
            </>
          )}

          {(letter.error || prep.error) && (
            <p role="alert" className="mt-3 mb-0 text-xs font-semibold text-danger">
              {letter.error ?? prep.error}
            </p>
          )}

          {letter.data && (
            <AiPanel
              className="mt-4"
              providerLabel={letter.providerLabel}
              usedFallback={letter.usedFallback}
            >
              <p className="m-0 text-[13px] leading-relaxed whitespace-pre-wrap">
                {letter.data.draft}
              </p>
              <Suggestion>
                Read it before sending. Anything it could not support from your profile is left
                out, not softened — fill those in yourself.
              </Suggestion>
            </AiPanel>
          )}

          {prep.data && (
            <AiPanel
              className="mt-4"
              providerLabel={prep.providerLabel}
              usedFallback={prep.usedFallback}
            >
              {prep.data.questions.length === 0 ? (
                <p className="m-0 text-[13px] text-muted">No questions were produced.</p>
              ) : (
                <ol className="m-0 grid list-decimal gap-3 pl-5">
                  {prep.data.questions.map((q, i) => (
                    <li key={i} className="text-[13px] leading-relaxed">
                      <b className="block">{q.question}</b>
                      <span className="mt-1 block text-muted">
                        Looking for: {q.whatTheyAreLookingFor}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </AiPanel>
          )}
        </Card>
      </div>
    </div>
  )
}
