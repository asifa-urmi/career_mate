'use client'

import { useActionState } from 'react'
import { Button, Card, Field, Input, Select, Textarea } from '@/components/ui'
import { CATEGORIES } from '@/config/categories'
import type { SetupFormState } from '@/app/(auth)/onboarding/actions'

type Action = (state: SetupFormState, formData: FormData) => Promise<SetupFormState>

const SECTOR_OPTIONS = CATEGORIES.map((c) => ({ value: c.value as string, label: c.label }))

const SIZE_OPTIONS = [
  { value: '1–10', label: '1–10 people' },
  { value: '11–50', label: '11–50 people' },
  { value: '51–200', label: '51–200 people' },
  { value: '201–1000', label: '201–1000 people' },
  { value: '1000+', label: '1000+ people' },
]

export function CompanySetupForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState<SetupFormState, FormData>(action, {})

  return (
    <form action={formAction} className="mx-auto w-[min(760px,100%)]">
      <Card padded className="mt-6 p-7">
        <h1 className="m-0 mb-2 font-display text-[30px] font-extrabold">Set up your company</h1>
        <p className="m-0 mb-6 text-sm leading-relaxed text-muted">
          This appears on every role you post. If your company is already on CareerMate, using
          the same name joins that profile rather than creating a second one.
        </p>

        {state.formError && (
          <p
            role="alert"
            className="m-0 mb-4 rounded-[var(--radius-field)] bg-[#fff0f3] px-3.5 py-3 text-[13px] font-semibold text-[#b83c51]"
          >
            {state.formError}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Company name"
            htmlFor="companyName"
            error={state.fieldErrors?.companyName}
            required
            className="sm:col-span-2"
          >
            <Input
              id="companyName"
              name="companyName"
              placeholder="e.g. Nexa Labs"
              aria-invalid={Boolean(state.fieldErrors?.companyName)}
            />
          </Field>

          <Field label="Sector" htmlFor="sector" error={state.fieldErrors?.sector} required>
            <Select id="sector" name="sector" options={SECTOR_OPTIONS} />
          </Field>

          <Field label="Company size" htmlFor="size" error={state.fieldErrors?.size}>
            <Select id="size" name="size" options={SIZE_OPTIONS} placeholder="Select a size" />
          </Field>

          <Field label="Your job title" htmlFor="title" error={state.fieldErrors?.title}>
            <Input id="title" name="title" placeholder="e.g. HR Manager" />
          </Field>

          <Field label="Location" htmlFor="location" error={state.fieldErrors?.location}>
            <Input id="location" name="location" placeholder="e.g. Dhaka, Bangladesh" />
          </Field>

          <Field
            label="Website"
            htmlFor="website"
            hint="Optional. Include https://"
            error={state.fieldErrors?.website}
            className="sm:col-span-2"
          >
            <Input
              id="website"
              name="website"
              placeholder="https://example.com"
              aria-invalid={Boolean(state.fieldErrors?.website)}
            />
          </Field>

          <Field
            label="About the company"
            htmlFor="about"
            hint="Optional. Candidates read this on your job posts."
            error={state.fieldErrors?.about}
            className="sm:col-span-2"
          >
            <Textarea id="about" name="about" rows={4} placeholder="What your company does…" />
          </Field>
        </div>

        <div className="mt-7 flex justify-end">
          <Button type="submit" loading={pending}>
            Open employer workspace
          </Button>
        </div>
      </Card>
    </form>
  )
}
