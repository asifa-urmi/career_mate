'use client'

import { useActionState } from 'react'
import { Button, Card, CardTitle, Field, Input, Select, Textarea } from '@/components/ui'
import { CATEGORIES, categoryLabel } from '@/config/categories'
import { JOB_TYPES, WORK_MODES } from '@/config/constants'
import type { JobCategory } from '@prisma/client'

export type JobFormState = {
  fieldErrors?: Record<string, string[]>
  formError?: string
}

export type JobFormValues = {
  title: string
  category: string
  location: string
  workMode: string
  jobType: string
  salaryMinBdt: string
  salaryMaxBdt: string
  salaryNote: string
  summary: string
  responsibilities: string
  requirements: string
  requiredSkills: string
  preferredSkills: string
  screeningQuestions: string
}

type Action = (state: JobFormState, formData: FormData) => Promise<JobFormState>

const SECTOR_OPTIONS = CATEGORIES.map((c) => ({ value: c.value as string, label: c.label }))

/**
 * What a good posting in each sector actually specifies.
 *
 * The prototype's promise was that this platform does not force every role
 * through a software-skills template, and this is where that shows: a nursing
 * post needs registration and ward experience, not a GitHub profile.
 */
const SECTOR_GUIDANCE: Partial<Record<JobCategory, string>> = {
  TECHNOLOGY: 'Name the stack, the kind of system, and whether on-call is involved.',
  MARKETING: 'Say which channels, what budget scale, and which metrics the role owns.',
  SALES: 'State the target, the cycle length and whether the incentive is capped.',
  FINANCE: 'Name the standards, the systems, and whether the role signs anything off.',
  HR: 'Say headcount supported, which processes are owned, and reporting line.',
  DESIGN: 'Ask for a portfolio, and say whether the role includes research.',
  OPERATIONS: 'Name the volume, the shift pattern, and any vendor responsibility.',
  CUSTOMER_SUPPORT: 'State the channels, the shift pattern and the languages required.',
  HEALTHCARE: 'State the registration required, the ward or unit, and the shift pattern.',
  EDUCATION: 'Name the level, the curriculum and the class size.',
}

export function JobForm({
  action,
  values,
  submitLabel,
  secondaryAction,
}: {
  action: Action
  values?: Partial<JobFormValues>
  submitLabel: string
  secondaryAction?: React.ReactNode
}) {
  const [state, formAction, pending] = useActionState<JobFormState, FormData>(action, {})
  const category = (values?.category ?? 'TECHNOLOGY') as JobCategory
  const guidance = SECTOR_GUIDANCE[category]

  return (
    <form action={formAction} className="grid gap-4.5">
      {state.formError && (
        <p
          role="alert"
          className="m-0 rounded-[var(--radius-field)] bg-[#fff0f3] px-3.5 py-3 text-[13px] font-semibold text-[#b83c51]"
        >
          {state.formError}
        </p>
      )}

      <Card padded>
        <CardTitle>The role</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Job title"
            htmlFor="title"
            error={state.fieldErrors?.title}
            required
            className="sm:col-span-2"
          >
            <Input id="title" name="title" defaultValue={values?.title} placeholder="e.g. Accounts Officer" />
          </Field>

          <Field label="Sector" htmlFor="category" error={state.fieldErrors?.category} required>
            <Select
              id="category"
              name="category"
              options={SECTOR_OPTIONS}
              defaultValue={values?.category}
            />
          </Field>

          <Field label="Location" htmlFor="location" error={state.fieldErrors?.location} required>
            <Input id="location" name="location" defaultValue={values?.location} placeholder="e.g. Dhaka" />
          </Field>

          <Field label="Work mode" htmlFor="workMode" error={state.fieldErrors?.workMode} required>
            <Select
              id="workMode"
              name="workMode"
              options={WORK_MODES.filter((m) => m.value !== 'ANY')}
              defaultValue={values?.workMode}
            />
          </Field>

          <Field label="Job type" htmlFor="jobType" error={state.fieldErrors?.jobType} required>
            <Select id="jobType" name="jobType" options={JOB_TYPES} defaultValue={values?.jobType} />
          </Field>

          <Field
            label="Summary"
            htmlFor="summary"
            hint="One or two sentences. This is what candidates read first."
            error={state.fieldErrors?.summary}
            required
            className="sm:col-span-2"
          >
            <Textarea id="summary" name="summary" rows={3} defaultValue={values?.summary} />
          </Field>
        </div>

        {guidance && (
          <p className="suggestion m-0 mt-4 rounded-lg p-3 text-xs leading-relaxed">
            <b>For a {categoryLabel(category)} role:</b> {guidance}
          </p>
        )}
      </Card>

      <Card padded>
        <CardTitle>Detail</CardTitle>
        <div className="grid gap-4">
          <Field
            label="Responsibilities"
            htmlFor="responsibilities"
            hint="One per line."
            error={state.fieldErrors?.responsibilities}
            required
          >
            <Textarea
              id="responsibilities"
              name="responsibilities"
              rows={5}
              defaultValue={values?.responsibilities}
              placeholder={'Record daily transactions\nPrepare bank reconciliations'}
            />
          </Field>

          <Field
            label="Requirements"
            htmlFor="requirements"
            hint="One per line."
            error={state.fieldErrors?.requirements}
          >
            <Textarea
              id="requirements"
              name="requirements"
              rows={5}
              defaultValue={values?.requirements}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Required skills"
              htmlFor="requiredSkills"
              hint="Comma separated."
              error={state.fieldErrors?.requiredSkills}
            >
              <Input
                id="requiredSkills"
                name="requiredSkills"
                defaultValue={values?.requiredSkills}
                placeholder="Excel, VAT/Tax"
              />
            </Field>

            <Field
              label="Nice to have"
              htmlFor="preferredSkills"
              hint="Comma separated."
              error={state.fieldErrors?.preferredSkills}
            >
              <Input
                id="preferredSkills"
                name="preferredSkills"
                defaultValue={values?.preferredSkills}
                placeholder="ERP, QuickBooks"
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card padded>
        <CardTitle>Pay</CardTitle>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Monthly minimum"
            htmlFor="salaryMinBdt"
            error={state.fieldErrors?.salaryMinBdt}
          >
            <Input
              id="salaryMinBdt"
              name="salaryMinBdt"
              inputMode="numeric"
              defaultValue={values?.salaryMinBdt}
              placeholder="38000"
            />
          </Field>

          <Field
            label="Monthly maximum"
            htmlFor="salaryMaxBdt"
            error={state.fieldErrors?.salaryMaxBdt}
          >
            <Input
              id="salaryMaxBdt"
              name="salaryMaxBdt"
              inputMode="numeric"
              defaultValue={values?.salaryMaxBdt}
              placeholder="55000"
            />
          </Field>

          <Field
            label="Note"
            htmlFor="salaryNote"
            hint="e.g. incentive"
            error={state.fieldErrors?.salaryNote}
          >
            <Input id="salaryNote" name="salaryNote" defaultValue={values?.salaryNote} />
          </Field>
        </div>
        <p className="m-0 mt-3 text-xs leading-relaxed text-muted">
          Leave both blank to show &ldquo;Negotiable&rdquo;. Posting a range gets more
          applications than hiding it.
        </p>
      </Card>

      <Card padded>
        <CardTitle>Screening questions</CardTitle>
        <Field
          label="Questions"
          htmlFor="screeningQuestions"
          hint="One per line, up to ten. Candidates answer these when they apply."
          error={state.fieldErrors?.screeningQuestions}
        >
          <Textarea
            id="screeningQuestions"
            name="screeningQuestions"
            rows={4}
            defaultValue={values?.screeningQuestions}
            placeholder={'Why this role?\nWhat is your notice period?'}
          />
        </Field>
      </Card>

      <div className="flex flex-wrap justify-end gap-2.5">
        {secondaryAction}
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
