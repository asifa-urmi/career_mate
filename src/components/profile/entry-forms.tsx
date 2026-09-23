'use client'

import { EntrySection, Field, Input, Textarea } from './profile-sections'
import type { Action, EntryValues } from './profile-sections'

/**
 * The three repeating profile sections, each with its own fields.
 *
 * `EntrySection` takes its fields as a render prop, because the form re-renders
 * per entry with that entry's values and the action's current errors. A function
 * cannot cross from a server component into a client one — React serialises what
 * crosses that boundary and a function does not serialise — so the page used to
 * fail its whole render and return 500 with a digest and no reason.
 *
 * Keeping the render prop entirely inside the client boundary is what fixes
 * that. The page passes rows and a server action, both of which serialise.
 */

type Entry = {
  id: string
  primary: string
  secondary: string
  tertiary?: string
  values: EntryValues
}

export function ExperienceSection({ entries, action }: { entries: Entry[]; action: Action }) {
  return (
    <EntrySection
      title="Work experience"
      addLabel="+ Add a role"
      kind="experience"
      action={action}
      entries={entries}
    >
      {(state, v) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Job title" htmlFor="title" error={state.fieldErrors?.title} required>
              <Input
                id="title"
                name="title"
                defaultValue={String(v.title ?? '')}
                placeholder="Accounts Officer"
              />
            </Field>
            <Field label="Company" htmlFor="company" error={state.fieldErrors?.company} required>
              <Input
                id="company"
                name="company"
                defaultValue={String(v.company ?? '')}
                placeholder="Meridian Group"
              />
            </Field>
            <Field label="Started" htmlFor="startDate" error={state.fieldErrors?.startDate} required>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={String(v.startDate ?? '')}
              />
            </Field>
            <Field label="Ended" htmlFor="endDate" error={state.fieldErrors?.endDate}>
              <Input
                id="endDate"
                name="endDate"
                type="date"
                defaultValue={String(v.endDate ?? '')}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              name="isCurrent"
              defaultChecked={Boolean(v.isCurrent)}
              className="size-4 accent-[var(--color-blue)]"
            />
            I still work here
          </label>
          <Field label="What you did" htmlFor="description" error={state.fieldErrors?.description}>
            <Textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={String(v.description ?? '')}
            />
          </Field>
        </>
      )}
    </EntrySection>
  )
}

export function EducationSection({ entries, action }: { entries: Entry[]; action: Action }) {
  return (
    <EntrySection
      title="Education"
      addLabel="+ Add education"
      kind="education"
      action={action}
      entries={entries}
    >
      {(state, v) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Degree" htmlFor="degree" error={state.fieldErrors?.degree} required>
            <Input
              id="degree"
              name="degree"
              defaultValue={String(v.degree ?? '')}
              placeholder="BBA in Accounting"
            />
          </Field>
          <Field
            label="Institution"
            htmlFor="institution"
            error={state.fieldErrors?.institution}
            required
          >
            <Input
              id="institution"
              name="institution"
              defaultValue={String(v.institution ?? '')}
              placeholder="Dhaka University"
            />
          </Field>
          <Field label="Started" htmlFor="startDate" error={state.fieldErrors?.startDate}>
            <Input
              id="startDate"
              name="startDate"
              type="date"
              defaultValue={String(v.startDate ?? '')}
            />
          </Field>
          <Field label="Finished" htmlFor="endDate" error={state.fieldErrors?.endDate}>
            <Input
              id="endDate"
              name="endDate"
              type="date"
              defaultValue={String(v.endDate ?? '')}
            />
          </Field>
        </div>
      )}
    </EntrySection>
  )
}

export function LinkSection({ entries, action }: { entries: Entry[]; action: Action }) {
  return (
    <EntrySection
      title="Links"
      addLabel="+ Add a link"
      kind="link"
      action={action}
      entries={entries}
    >
      {(state, v) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="label" error={state.fieldErrors?.label} required>
            <Input
              id="label"
              name="label"
              defaultValue={String(v.label ?? '')}
              placeholder="Portfolio"
            />
          </Field>
          <Field label="Address" htmlFor="url" error={state.fieldErrors?.url} required>
            <Input
              id="url"
              name="url"
              defaultValue={String(v.url ?? '')}
              placeholder="https://example.com"
            />
          </Field>
        </div>
      )}
    </EntrySection>
  )
}
