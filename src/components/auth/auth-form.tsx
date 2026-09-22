'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Button, Field, Input } from '@/components/ui'
import { cn } from '@/lib/utils/cn'
import type { AuthFormState } from '@/app/(auth)/actions'

type Action = (state: AuthFormState, formData: FormData) => Promise<AuthFormState>

export function AuthForm({ mode, action }: { mode: 'login' | 'signup'; action: Action }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(action, {})
  const signup = mode === 'signup'
  const [role, setRole] = useState(state.values?.role ?? 'CANDIDATE')

  return (
    <form action={formAction} className="grid gap-4">
      {state.formError && (
        <p
          role="alert"
          className="m-0 rounded-[var(--radius-field)] bg-[#fff0f3] px-3.5 py-3 text-[13px] font-semibold text-[#b83c51]"
        >
          {state.formError}
        </p>
      )}

      {signup && (
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-2 text-[13px] font-bold text-navy">
            How will you use CareerMate?
          </legend>
          <div className="grid grid-cols-2 gap-2.5">
            <RoleChoice
              value="CANDIDATE"
              glyph="◉"
              title="Job seeker"
              subtitle="Find jobs & apply"
              selected={role === 'CANDIDATE'}
              onSelect={setRole}
            />
            <RoleChoice
              value="EMPLOYER"
              glyph="▦"
              title="Employer"
              subtitle="Post jobs & hire"
              selected={role === 'EMPLOYER'}
              onSelect={setRole}
            />
          </div>
          <input type="hidden" name="role" value={role} />
          {state.fieldErrors?.role && (
            <p role="alert" className="mt-1.5 mb-0 text-xs font-semibold text-danger">
              {state.fieldErrors.role.join(' ')}
            </p>
          )}
        </fieldset>
      )}

      {signup && (
        <Field label="Full name" htmlFor="name" error={state.fieldErrors?.name} required>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            defaultValue={state.values?.name ?? ''}
            aria-invalid={Boolean(state.fieldErrors?.name)}
            aria-describedby={state.fieldErrors?.name ? 'name-error' : undefined}
            placeholder="Your name"
          />
        </Field>
      )}

      <Field label="Email address" htmlFor="email" error={state.fieldErrors?.email} required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.values?.email ?? ''}
          aria-invalid={Boolean(state.fieldErrors?.email)}
          aria-describedby={state.fieldErrors?.email ? 'email-error' : undefined}
          placeholder="name@example.com"
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        error={state.fieldErrors?.password}
        hint={signup ? 'At least 8 characters.' : undefined}
        required
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={signup ? 'new-password' : 'current-password'}
          aria-invalid={Boolean(state.fieldErrors?.password)}
          aria-describedby={state.fieldErrors?.password ? 'password-error' : 'password-hint'}
          placeholder="••••••••"
        />
      </Field>

      <Button type="submit" className="w-full" loading={pending}>
        {signup ? 'Create account' : 'Sign in'}
      </Button>

      <p className="m-0 text-center text-[13px] text-muted">
        {signup ? 'Already have an account?' : 'New here?'}{' '}
        <Link href={signup ? '/login' : '/signup'} className="font-extrabold text-blue">
          {signup ? 'Sign in' : 'Create an account'}
        </Link>
      </p>
    </form>
  )
}

function RoleChoice({
  value,
  glyph,
  title,
  subtitle,
  selected,
  onSelect,
}: {
  value: string
  glyph: string
  title: string
  subtitle: string
  selected: boolean
  onSelect: (value: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={selected}
      className={cn(
        'rounded-[14px] border bg-surface p-4 text-center transition-all',
        selected
          ? 'border-blue shadow-[0_0_0_3px_rgb(47_107_255_/_0.08)]'
          : 'border-line hover:border-blue',
      )}
    >
      <span className="block text-2xl" aria-hidden="true">
        {glyph}
      </span>
      <b className="mt-1 block text-[13px]">{title}</b>
      <small className="block text-[11px] text-muted">{subtitle}</small>
    </button>
  )
}
