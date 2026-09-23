'use client'

import { useActionState, useState } from 'react'
import { Button, Card, Field, Input, Select, Stepper, Suggestion, UploadBox } from '@/components/ui'
import { CATEGORIES } from '@/config/categories'
import {
  ACCEPTED_RESUME_EXTENSIONS,
  ACCEPTED_RESUME_MIME,
  EXPERIENCE_LEVELS,
  JOB_TYPES,
  MAX_RESUME_BYTES,
  WORK_MODES,
} from '@/config/constants'
import { textGlyph } from '@/lib/utils/glyph'
import { cn } from '@/lib/utils/cn'
import type { SetupFormState } from '@/app/(auth)/onboarding/actions'

const STEPS = ['Sector', 'Preferences', 'CV', 'Profile', 'Ready'] as const

type Action = (state: SetupFormState, formData: FormData) => Promise<SetupFormState>

/**
 * Five steps, one submit.
 *
 * Everything lives in the form until the last step, so an abandoned wizard
 * writes nothing — there is no half-built profile to clean up, and no state where
 * the onboarded flag is set but the preferences are missing.
 */
export function OnboardingWizard({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState<SetupFormState, FormData>(action, {})
  const [step, setStep] = useState(1)
  const [sector, setSector] = useState<string>('')

  // A server-side rejection means a field the wizard already passed is wrong.
  // Dropping the person back to step one would lose the rest of their answers,
  // so the error is shown where they are and the whole form is still submitted.
  const hasFieldErrors = Boolean(state.fieldErrors && Object.keys(state.fieldErrors).length)

  return (
    <form action={formAction} className="mx-auto w-[min(850px,100%)]">
      <Stepper steps={STEPS} current={step} />

      <Card padded className="p-7">
        {state.formError && (
          <p
            role="alert"
            className="m-0 mb-4 rounded-[var(--radius-field)] bg-[#fff0f3] px-3.5 py-3 text-[13px] font-semibold text-[#b83c51]"
          >
            {state.formError}
          </p>
        )}
        {hasFieldErrors && step !== 1 && (
          <p
            role="alert"
            className="m-0 mb-4 rounded-[var(--radius-field)] bg-[#fff4df] px-3.5 py-3 text-[13px] font-semibold text-[#8b5f10]"
          >
            Something in an earlier step needs fixing — step back to check.
          </p>
        )}

        {/* Every step stays mounted so its values survive navigation and reach
            the single submit; only the current one is shown. */}
        <div className={cn(step !== 1 && 'hidden')}>
          <h1 className="m-0 mb-2 font-display text-[30px] font-extrabold">
            What kind of work are you looking for?
          </h1>
          <p className="m-0 mb-5 text-sm leading-relaxed text-muted">
            Pick your main sector. You can search any sector later — this only shapes what we
            put first.
          </p>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setSector(c.value)}
                aria-pressed={sector === c.value}
                className={cn(
                  'rounded-[14px] border bg-surface p-4 text-center transition-all',
                  sector === c.value
                    ? 'border-blue shadow-[0_0_0_3px_rgb(47_107_255_/_0.08)]'
                    : 'border-line hover:border-blue',
                )}
              >
                <span className="block text-2xl" aria-hidden="true">
                  {textGlyph(c.glyph)}
                </span>
                <b className="mt-1 block text-[13px]">{c.label}</b>
              </button>
            ))}
          </div>
          <input type="hidden" name="primarySector" value={sector} />
          {state.fieldErrors?.primarySector && (
            <p role="alert" className="mt-3 mb-0 text-xs font-semibold text-danger">
              {state.fieldErrors.primarySector.join(' ')}
            </p>
          )}
        </div>

        <div className={cn('grid gap-4 sm:grid-cols-2', step !== 2 && 'hidden')}>
          <div className="sm:col-span-2">
            <h1 className="m-0 mb-2 font-display text-[30px] font-extrabold">
              Set your job preferences
            </h1>
            <p className="m-0 text-sm leading-relaxed text-muted">
              These improve ranking. They never hide roles from you.
            </p>
          </div>

          <Field label="Target role" htmlFor="targetRole" error={state.fieldErrors?.targetRole}>
            <Input
              id="targetRole"
              name="targetRole"
              placeholder="e.g. Accounts Officer, Teacher, Designer"
            />
          </Field>

          <Field
            label="Experience level"
            htmlFor="experienceLevel"
            error={state.fieldErrors?.experienceLevel}
            required
          >
            <Select id="experienceLevel" name="experienceLevel" options={EXPERIENCE_LEVELS} />
          </Field>

          <Field
            label="Preferred location"
            htmlFor="preferredLocation"
            error={state.fieldErrors?.preferredLocation}
          >
            <Input id="preferredLocation" name="preferredLocation" placeholder="Dhaka / Remote" />
          </Field>

          <Field label="Job type" htmlFor="jobType" error={state.fieldErrors?.jobType} required>
            <Select id="jobType" name="jobType" options={JOB_TYPES} />
          </Field>

          <Field
            label="Minimum monthly salary"
            htmlFor="minSalaryBdt"
            hint="Optional. Leave blank for no preference."
            error={state.fieldErrors?.minSalaryBdt}
          >
            <Input
              id="minSalaryBdt"
              name="minSalaryBdt"
              inputMode="numeric"
              placeholder="35000"
            />
          </Field>

          <Field label="Work mode" htmlFor="workMode" error={state.fieldErrors?.workMode} required>
            <Select id="workMode" name="workMode" options={WORK_MODES} />
          </Field>
        </div>

        <div className={cn(step !== 3 && 'hidden')}>
          <h1 className="m-0 mb-2 font-display text-[30px] font-extrabold">Add your CV</h1>
          <p className="m-0 mb-5 text-sm leading-relaxed text-muted">
            CV upload and parsing arrive with the AI features. You can finish setting up now and
            add your CV from the CV &amp; Resume page whenever it suits you.
          </p>
          <UploadBox
            accept={ACCEPTED_RESUME_MIME}
            acceptExtensions={ACCEPTED_RESUME_EXTENSIONS}
            maxBytes={MAX_RESUME_BYTES}
            onFile={() => undefined}
            disabled
            hint="Not yet available"
          />
          <Suggestion>
            <b>How AI is used here:</b> CareerMate may point out information your CV is missing.
            It will not invent experience, degrees or certifications you do not have.
          </Suggestion>
        </div>

        <div className={cn(step !== 4 && 'hidden')}>
          <h1 className="m-0 mb-2 font-display text-[30px] font-extrabold">
            Add a headline
          </h1>
          <p className="m-0 mb-5 text-sm leading-relaxed text-muted">
            One line describing what you do. It appears at the top of your profile and beside
            your applications.
          </p>
          <Field label="Professional headline" htmlFor="headline" error={state.fieldErrors?.headline}>
            <Input
              id="headline"
              name="headline"
              placeholder="e.g. Accounts Officer with 3 years in corporate finance"
            />
          </Field>
        </div>

        <div className={cn(step !== 5 && 'hidden')}>
          <h1 className="m-0 mb-2 font-display text-[30px] font-extrabold">
            Your workspace is ready
          </h1>
          <p className="m-0 mb-5 text-sm leading-relaxed text-muted">
            CareerMate will lead with roles in your chosen sector, and you can search every other
            sector at any time.
          </p>
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

          {step < STEPS.length ? (
            <Button
              type="button"
              onClick={() => setStep((s) => Math.min(STEPS.length, s + 1))}
              disabled={step === 1 && !sector}
            >
              Continue
            </Button>
          ) : (
            <Button type="submit" loading={pending}>
              Open my dashboard
            </Button>
          )}
        </div>
      </Card>
    </form>
  )
}
