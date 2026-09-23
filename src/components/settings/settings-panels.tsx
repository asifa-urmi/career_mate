'use client'

import { useActionState, useState, useTransition } from 'react'
import type { NotificationType } from '@prisma/client'
import { Button, Card, CardTitle, Field, Input, Suggestion, useToast } from '@/components/ui'
import {
  changeEmailAction,
  changePasswordAction,
  deleteAccountAction,
  exportDataAction,
  saveNotificationsAction,
  type SettingsState,
} from '@/app/(shared)/settings/actions'

function Note({ state }: { state: SettingsState }) {
  if (state.error) {
    return (
      <p role="alert" className="m-0 text-xs font-semibold text-danger">
        {state.error}
      </p>
    )
  }
  if (state.saved) {
    return (
      <p role="status" className="m-0 text-xs leading-relaxed font-semibold text-mint-ink">
        {state.saved}
      </p>
    )
  }
  return null
}

export function EmailPanel({ email }: { email: string }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(changeEmailAction, {})

  return (
    <Card padded>
      <CardTitle>Email address</CardTitle>
      <form action={action} className="grid gap-4">
        <Field label="Email" htmlFor="email" hint="You sign in with this.">
          <Input id="email" name="email" type="email" defaultValue={email} />
        </Field>
        <div className="flex items-center justify-end gap-3">
          <Note state={state} />
          <Button type="submit" size="sm" loading={pending}>
            Change email
          </Button>
        </div>
      </form>
    </Card>
  )
}

export function PasswordPanel() {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    changePasswordAction,
    {},
  )

  return (
    <Card padded>
      <CardTitle>Password</CardTitle>
      <form action={action} className="grid gap-4">
        <Field
          label="Current password"
          htmlFor="currentPassword"
          hint="Asked for so that an unlocked screen is not a password change away from a stolen account."
        >
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
          />
        </Field>
        <Field label="New password" htmlFor="newPassword" hint="At least 8 characters.">
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
          />
        </Field>
        <div className="flex items-center justify-end gap-3">
          <Note state={state} />
          <Button type="submit" size="sm" loading={pending}>
            Change password
          </Button>
        </div>
      </form>
    </Card>
  )
}

const NOTIFICATION_TYPES: { value: NotificationType; label: string; description: string }[] = [
  {
    value: 'APPLICATION_UPDATE',
    label: 'Application updates',
    description: 'When an employer moves one of your applications to a new stage.',
  },
  {
    value: 'NEW_MESSAGE',
    label: 'Messages',
    description: 'When someone writes to you.',
  },
  {
    value: 'JOB_MATCH',
    label: 'Job matches',
    description: 'When a role that fits your profile is posted.',
  },
  {
    value: 'SYSTEM',
    label: 'Account and platform',
    description: 'Moderation outcomes, account changes and safety notices.',
  },
]

export function NotificationsPanel({ enabled }: { enabled: NotificationType[] }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    saveNotificationsAction,
    {},
  )

  return (
    <Card padded>
      <CardTitle>Notifications</CardTitle>
      <form action={action} className="grid gap-3">
        {NOTIFICATION_TYPES.map((type) => (
          <label
            key={type.value}
            className="flex cursor-pointer items-start gap-3 rounded-[10px] border border-line p-3.5"
          >
            <input
              type="checkbox"
              name="notifyOn"
              value={type.value}
              defaultChecked={enabled.includes(type.value)}
              className="mt-0.5 size-4 accent-[var(--color-blue)]"
            />
            <span>
              <b className="block text-[13px]">{type.label}</b>
              <span className="block text-xs leading-relaxed text-muted">{type.description}</span>
            </span>
          </label>
        ))}

        <div className="flex items-center justify-end gap-3">
          <Note state={state} />
          <Button type="submit" size="sm" loading={pending}>
            Save preferences
          </Button>
        </div>
      </form>
    </Card>
  )
}

export function DataPanel() {
  const [pending, start] = useTransition()
  const { show } = useToast()

  function download() {
    start(async () => {
      const result = await exportDataAction()
      if (result.error || !result.json) {
        show(result.error ?? 'Could not build your export', 'error')
        return
      }

      // Built in the browser from data the server already sent, so the file
      // never touches disk anywhere else.
      const blob = new Blob([result.json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'careermate-data.json'
      link.click()
      URL.revokeObjectURL(url)
    })
  }

  return (
    <Card padded>
      <CardTitle>Your data</CardTitle>
      <p className="m-0 mb-4 text-[13px] leading-relaxed text-muted">
        Everything CareerMate holds about you — profile, applications, saved jobs, messages and
        notifications — as a JSON file.
      </p>
      <Button type="button" variant="soft" loading={pending} onClick={download}>
        Download my data
      </Button>
    </Card>
  )
}

export function DangerPanel() {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    deleteAccountAction,
    {},
  )
  const [open, setOpen] = useState(false)

  return (
    <Card padded className="border-[#f3c9d0]">
      <CardTitle className="text-[#b83c51]">Delete your account</CardTitle>
      <p className="m-0 text-[13px] leading-relaxed text-muted">
        This removes your profile, applications, saved jobs, CVs and messages. It cannot be
        undone.
      </p>

      <Suggestion>
        If you just want to stop being contacted, turn off notifications above instead — that is
        reversible and this is not.
      </Suggestion>

      {!open ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-3"
          onClick={() => setOpen(true)}
        >
          I want to delete my account
        </Button>
      ) : (
        <form action={action} className="mt-4 grid gap-3">
          <Field label="Type DELETE to confirm" htmlFor="confirmation">
            <Input id="confirmation" name="confirmation" placeholder="DELETE" autoComplete="off" />
          </Field>
          <div className="flex items-center justify-end gap-3">
            <Note state={state} />
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Keep my account
            </Button>
            <Button type="submit" variant="danger" size="sm" loading={pending}>
              Delete permanently
            </Button>
          </div>
        </form>
      )}
    </Card>
  )
}
