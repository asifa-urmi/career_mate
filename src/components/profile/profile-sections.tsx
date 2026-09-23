'use client'

import { useActionState, useState, useTransition } from 'react'
import { Button, Card, CardTitle, Field, Input, Select, Textarea, useToast } from '@/components/ui'
import { CATEGORIES } from '@/config/categories'
import { EXPERIENCE_LEVELS } from '@/config/constants'
import type { ProfileFormState } from '@/app/(candidate)/profile/actions'
import { deleteEntryAction } from '@/app/(candidate)/profile/actions'

export type Action = (state: ProfileFormState, formData: FormData) => Promise<ProfileFormState>

const SECTOR_OPTIONS = CATEGORIES.map((c) => ({ value: c.value as string, label: c.label }))

function SavedNote({ state }: { state: ProfileFormState }) {
  if (state.formError) {
    return (
      <p role="alert" className="m-0 text-xs font-semibold text-danger">
        {state.formError}
      </p>
    )
  }
  if (state.saved) {
    return (
      <p role="status" className="m-0 text-xs font-semibold text-mint-ink">
        Saved
      </p>
    )
  }
  return null
}

export function BasicsSection({
  action,
  values,
}: {
  action: Action
  values: {
    headline: string
    location: string
    bio: string
    experienceLevel: string
    primarySector: string
  }
}) {
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(action, {})

  return (
    <Card padded>
      <CardTitle>About you</CardTitle>
      <form action={formAction} className="grid gap-4">
        <Field
          label="Headline"
          htmlFor="headline"
          hint="One line. It appears beside every application you send."
          error={state.fieldErrors?.headline}
        >
          <Input
            id="headline"
            name="headline"
            defaultValue={values.headline}
            placeholder="e.g. Accounts Officer with 3 years in corporate finance"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Location" htmlFor="location" error={state.fieldErrors?.location}>
            <Input id="location" name="location" defaultValue={values.location} placeholder="Dhaka" />
          </Field>

          <Field
            label="Experience"
            htmlFor="experienceLevel"
            error={state.fieldErrors?.experienceLevel}
          >
            <Select
              id="experienceLevel"
              name="experienceLevel"
              options={EXPERIENCE_LEVELS}
              defaultValue={values.experienceLevel}
            />
          </Field>

          <Field label="Main sector" htmlFor="primarySector" error={state.fieldErrors?.primarySector}>
            <Select
              id="primarySector"
              name="primarySector"
              options={SECTOR_OPTIONS}
              defaultValue={values.primarySector}
            />
          </Field>
        </div>

        <Field
          label="Summary"
          htmlFor="bio"
          hint="A short paragraph. Employers read this first."
          error={state.fieldErrors?.bio}
        >
          <Textarea id="bio" name="bio" rows={4} defaultValue={values.bio} />
        </Field>

        <div className="flex items-center justify-end gap-3">
          <SavedNote state={state} />
          <Button type="submit" size="sm" loading={pending}>
            Save
          </Button>
        </div>
      </form>
    </Card>
  )
}

/**
 * A collapsed "add" form that opens in place.
 *
 * Kept as one component for experience, education and links because the shape is
 * identical — a form, a list, a delete — and three near-copies is how they drift.
 */
export type EntryValues = Record<string, string | boolean | undefined>

export function EntrySection({
  title,
  addLabel,
  action,
  kind,
  entries,
  children,
}: {
  title: string
  addLabel: string
  action: Action
  kind: 'experience' | 'education' | 'link'
  entries: {
    id: string
    primary: string
    secondary: string
    tertiary?: string
    values: EntryValues
  }[]
  children: (state: ProfileFormState, values: EntryValues) => React.ReactNode
}) {
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(action, {})
  // `null` means closed, `''` means adding, an id means editing that row. One
  // piece of state, so the form cannot be open in two modes at once.
  const [editing, setEditing] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()
  const { show } = useToast()

  const open = editing !== null
  const current = entries.find((e) => e.id === editing)

  function remove(id: string) {
    if (!confirm('Remove this entry?')) return
    startDelete(async () => {
      const result = await deleteEntryAction(kind, id)
      if (!result.error && editing === id) setEditing(null)
      show(result.error ?? 'Removed', result.error ? 'error' : 'success')
    })
  }

  return (
    <Card padded>
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <CardTitle className="mb-0">{title}</CardTitle>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setEditing((v) => (v === '' ? null : ''))}
        >
          {editing === '' ? 'Cancel' : addLabel}
        </Button>
      </div>

      {entries.length === 0 && !open && (
        <p className="m-0 text-[13px] text-muted">Nothing here yet.</p>
      )}

      {entries.length > 0 && (
        <ul className="m-0 mb-4 grid list-none gap-2.5 p-0">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-start justify-between gap-3 rounded-[10px] border border-line p-3.5"
            >
              <div className="min-w-0">
                <b className="block text-sm">{entry.primary}</b>
                <span className="block text-[13px] text-muted">{entry.secondary}</span>
                {entry.tertiary && (
                  <span className="block text-[11px] text-muted">{entry.tertiary}</span>
                )}
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing((v) => (v === entry.id ? null : entry.id))}
                >
                  {editing === entry.id ? 'Cancel' : 'Edit'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={deleting}
                  onClick={() => remove(entry.id)}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <form
          // Remounts when the target changes, so the uncontrolled inputs pick up
          // the new defaultValues instead of keeping the previous row's text.
          key={editing}
          action={formAction}
          className="grid gap-4 border-t border-line pt-4"
        >
          {/* This is what makes the services' upsert-by-id path reachable, and
              with it the ownership predicate those branches carry. */}
          {current && <input type="hidden" name="id" value={current.id} />}
          {children(state, current?.values ?? {})}
          <div className="flex items-center justify-end gap-3">
            <SavedNote state={state} />
            <Button type="submit" size="sm" loading={pending}>
              {current ? 'Save changes' : 'Add'}
            </Button>
          </div>
        </form>
      )}
    </Card>
  )
}

export function SkillsSection({ action, skills }: { action: Action; skills: string[] }) {
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(action, {})

  return (
    <Card padded>
      <CardTitle>Skills</CardTitle>
      <form action={formAction} className="grid gap-4">
        <Field
          label="Your skills"
          htmlFor="skills"
          hint="Comma separated. These are matched against what roles ask for."
          error={state.fieldErrors?.skills}
        >
          <Input
            id="skills"
            name="skills"
            defaultValue={skills.join(', ')}
            placeholder="Excel, VAT/Tax, Reconciliation"
          />
        </Field>
        <div className="flex items-center justify-end gap-3">
          <SavedNote state={state} />
          <Button type="submit" size="sm" loading={pending}>
            Save skills
          </Button>
        </div>
      </form>
    </Card>
  )
}

export { Field, Input, Textarea }
