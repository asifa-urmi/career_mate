'use client'

import { useActionState } from 'react'
import { Button, Card, CardTitle, Field, Input, Select, Textarea } from '@/components/ui'
import { CATEGORIES } from '@/config/categories'
import type { CompanyFormState } from '@/app/(employer)/company-profile/actions'

type Action = (state: CompanyFormState, formData: FormData) => Promise<CompanyFormState>

const SECTOR_OPTIONS = CATEGORIES.map((c) => ({ value: c.value as string, label: c.label }))

const SIZE_OPTIONS = [
  { value: '1–10', label: '1–10 people' },
  { value: '11–50', label: '11–50 people' },
  { value: '51–200', label: '51–200 people' },
  { value: '201–1000', label: '201–1000 people' },
  { value: '1000+', label: '1000+ people' },
]

export function CompanyProfileForm({
  action,
  values,
}: {
  action: Action
  values: {
    companyName: string
    sector: string
    size: string
    website: string
    location: string
    about: string
    title: string
  }
}) {
  const [state, formAction, pending] = useActionState<CompanyFormState, FormData>(action, {})

  return (
    <Card padded>
      <CardTitle>Company details</CardTitle>

      {state.formError && (
        <p
          role="alert"
          className="m-0 mb-4 rounded-[var(--radius-field)] bg-[#fff0f3] px-3.5 py-3 text-[13px] font-semibold text-[#b83c51]"
        >
          {state.formError}
        </p>
      )}

      <form action={formAction} className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Company name"
          htmlFor="companyName"
          error={state.fieldErrors?.companyName}
          required
          className="sm:col-span-2"
        >
          <Input id="companyName" name="companyName" defaultValue={values.companyName} />
        </Field>

        <Field label="Sector" htmlFor="sector" error={state.fieldErrors?.sector} required>
          <Select id="sector" name="sector" options={SECTOR_OPTIONS} defaultValue={values.sector} />
        </Field>

        <Field label="Size" htmlFor="size" error={state.fieldErrors?.size}>
          <Select
            id="size"
            name="size"
            options={SIZE_OPTIONS}
            defaultValue={values.size}
            placeholder="Select a size"
          />
        </Field>

        <Field label="Location" htmlFor="location" error={state.fieldErrors?.location}>
          <Input id="location" name="location" defaultValue={values.location} />
        </Field>

        <Field label="Your job title" htmlFor="title" error={state.fieldErrors?.title}>
          <Input id="title" name="title" defaultValue={values.title} />
        </Field>

        <Field
          label="Website"
          htmlFor="website"
          hint="Include https://"
          error={state.fieldErrors?.website}
          className="sm:col-span-2"
        >
          <Input id="website" name="website" defaultValue={values.website} />
        </Field>

        <Field
          label="About the company"
          htmlFor="about"
          hint="Candidates read this on every role you post."
          error={state.fieldErrors?.about}
          className="sm:col-span-2"
        >
          <Textarea id="about" name="about" rows={5} defaultValue={values.about} />
        </Field>

        <div className="flex items-center justify-end gap-3 sm:col-span-2">
          {state.saved && (
            <p role="status" className="m-0 text-xs font-semibold text-mint-ink">
              Saved
            </p>
          )}
          <Button type="submit" loading={pending}>
            Save changes
          </Button>
        </div>
      </form>
    </Card>
  )
}
