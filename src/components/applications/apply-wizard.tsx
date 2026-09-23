'use client'

import { useActionState, useState } from 'react'
import { Button, Card, CardTitle, Field, Textarea, Stepper, Suggestion } from '@/components/ui'
import { cn } from '@/lib/utils/cn'
import type { ApplyFormState } from '@/app/(candidate)/apply/[id]/actions'

type Action = (state: ApplyFormState, formData: FormData) => Promise<ApplyFormState>

export type ResumeChoice = { id: string; label: string; isPrimary: boolean }

/**
 * Four steps, one submit.
 *
 * Everything stays in the form until the end, as the onboarding wizard does, so
 * an abandoned application writes nothing. The consent step is last and its
 * checkbox is required by the schema — consent that could be defaulted on is not
 * consent.
 */
export function ApplyWizard({
  jobId,
  jobTitle,
  companyName,
  screeningQuestions,
  resumes,
  action,
}: {
  jobId: string
  jobTitle: string
  companyName: string
  screeningQuestions: readonly string[]
  resumes: readonly ResumeChoice[]
  action: Action
}) {
  const [state, formAction, pending] = useActionState<ApplyFormState, FormData>(action, {})
  const [step, setStep] = useState(1)
  const [resumeId, setResumeId] = useState(resumes.find((r) => r.isPrimary)?.id ?? '')

  const steps = ['Your CV', 'Questions', 'Cover letter', 'Review'] as const
  const hasQuestions = screeningQuestions.length > 0

  return (
    <form action={formAction}>
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="resumeId" value={resumeId} />

      <Stepper steps={steps} current={step} />

      <Card padded className="p-6">
        {state.formError && (
          <p
            role="alert"
            className="m-0 mb-4 rounded-[var(--radius-field)] bg-[#fff0f3] px-3.5 py-3 text-[13px] font-semibold text-[#b83c51]"
          >
            {state.formError}
          </p>
        )}

        <div className={cn(step !== 1 && 'hidden')}>
          <CardTitle>Which CV should they see?</CardTitle>
          {resumes.length === 0 ? (
            <>
              <p className="m-0 mb-3 text-sm leading-relaxed text-muted">
                You have no CV on file yet. You can still apply — {companyName} will see your
                profile, your answers and your cover letter.
              </p>
              <Suggestion>
                You can upload one from the CV &amp; Resume page at any time. Adding a CV later
                does not change applications you have already sent, so it is worth doing before
                the next one.
              </Suggestion>
            </>
          ) : (
            <ul className="grid list-none gap-2.5 p-0">
              {resumes.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setResumeId(r.id)}
                    aria-pressed={resumeId === r.id}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-[12px] border bg-surface px-4 py-3 text-left transition-all',
                      resumeId === r.id
                        ? 'border-blue shadow-[0_0_0_3px_rgb(47_107_255_/_0.08)]'
                        : 'border-line hover:border-blue',
                    )}
                  >
                    <span className="text-sm font-bold">{r.label}</span>
                    {r.isPrimary && <span className="text-xs text-muted">Primary</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={cn(step !== 2 && 'hidden')}>
          <CardTitle>{hasQuestions ? 'Screening questions' : 'No screening questions'}</CardTitle>
          {hasQuestions ? (
            <div className="grid gap-4">
              {/* Keyed by index: duplicate question text would give duplicate
                  React keys, and typing in one box can then appear in another. */}
              {screeningQuestions.map((question, i) => (
                <Field key={i} label={question} htmlFor={`screening-${i}`}>
                  <Textarea
                    id={`screening-${i}`}
                    name={`screening.${i}`}
                    rows={3}
                    placeholder="Your answer"
                  />
                </Field>
              ))}
            </div>
          ) : (
            <p className="m-0 text-sm leading-relaxed text-muted">
              {companyName} has not set any questions for this role. Continue to your cover
              letter.
            </p>
          )}
        </div>

        <div className={cn(step !== 3 && 'hidden')}>
          <CardTitle>Anything else they should know?</CardTitle>
          <Field
            label="Cover letter"
            htmlFor="coverLetter"
            hint="Optional. A short, specific note reads better than a long general one."
            error={state.fieldErrors?.coverLetter}
          >
            <Textarea
              id="coverLetter"
              name="coverLetter"
              rows={8}
              placeholder={`Why you are a good fit for ${jobTitle}…`}
            />
          </Field>
        </div>

        <div className={cn(step !== 4 && 'hidden')}>
          <CardTitle>Review and submit</CardTitle>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-3 border-b border-line pb-2">
              <dt className="text-muted">Role</dt>
              <dd className="m-0 font-semibold">{jobTitle}</dd>
            </div>
            <div className="flex justify-between gap-3 border-b border-line pb-2">
              <dt className="text-muted">Company</dt>
              <dd className="m-0 font-semibold">{companyName}</dd>
            </div>
            <div className="flex justify-between gap-3 border-b border-line pb-2">
              <dt className="text-muted">CV</dt>
              <dd className="m-0 font-semibold">
                {resumes.find((r) => r.id === resumeId)?.label ?? 'None attached'}
              </dd>
            </div>
          </dl>

          <label className="mt-5 flex cursor-pointer items-start gap-2.5 rounded-[12px] border border-line p-3.5">
            <input
              type="checkbox"
              name="consented"
              className="mt-0.5 size-4 accent-[var(--color-blue)]"
            />
            <span className="text-[13px] leading-relaxed">
              Everything I have entered is accurate, and I agree to {companyName} seeing my
              profile, my answers and my CV for this application.
            </span>
          </label>
          {state.fieldErrors?.consented && (
            <p role="alert" className="mt-2 mb-0 text-xs font-semibold text-danger">
              {state.fieldErrors.consented.join(' ')}
            </p>
          )}
        </div>

        <div className="mt-7 flex justify-between gap-2.5">
          <Button
            type="button"
            variant="ghost"
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
          >
            Back
          </Button>

          {step < steps.length ? (
            <Button type="button" onClick={() => setStep((s) => Math.min(steps.length, s + 1))}>
              Continue
            </Button>
          ) : (
            <Button type="submit" loading={pending}>
              Submit application
            </Button>
          )}
        </div>
      </Card>
    </form>
  )
}
