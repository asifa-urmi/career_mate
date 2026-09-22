import type { Metadata } from 'next'
import { enforceAuthPage } from '@/lib/auth/enforce-auth-page'
import { AuthShell } from '@/components/auth/auth-shell'
import { AuthForm } from '@/components/auth/auth-form'
import { loginAction } from '../actions'

export const metadata: Metadata = { title: 'Sign in — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  await enforceAuthPage('/login')

  return (
    <AuthShell
      eyebrow="Career + hiring workspace"
      headline="Continue your job search or hiring workflow."
      body="Job discovery, CVs, applications, messages, AI guidance and employer hiring tools live in one platform."
      proof={['Multi-sector jobs', 'CV intelligence', 'Application tracking']}
    >
      <h1 className="m-0 mb-1.5 font-display text-[30px] font-extrabold">Welcome back</h1>
      <p className="mt-0 mb-6 text-sm text-muted">
        Use your email and password to continue.
      </p>
      <AuthForm mode="login" action={loginAction} />
    </AuthShell>
  )
}
