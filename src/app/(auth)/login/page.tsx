import type { Metadata } from 'next'
import { enforceAuthPage } from '@/lib/auth/enforce-auth-page'
import { AuthShell } from '@/components/auth/auth-shell'
import { AuthForm } from '@/components/auth/auth-form'
import { loginNoticeFor } from '@/lib/auth/email-callback'
import { loginAction } from '../actions'

export const metadata: Metadata = { title: 'Sign in — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>
}) {
  await enforceAuthPage('/login')

  // Set by the email callback when a confirmation link was dead or could not be
  // exchanged. Without rendering it, someone arrives here from a link that did
  // not work and is shown a plain sign-in form with no hint of what happened.
  const notice = loginNoticeFor((await searchParams).notice)

  return (
    <AuthShell
      eyebrow="Career + hiring workspace"
      headline="Continue your job search or hiring workflow."
      body="Job discovery, CVs, applications, messages, AI guidance and employer hiring tools live in one platform."
      proof={['Multi-sector jobs', 'CV intelligence', 'Application tracking']}
    >
      <h1 className="m-0 mb-1.5 font-display text-[30px] font-extrabold">Welcome back</h1>
      {notice && (
        <p
          role="status"
          className="m-0 mb-4 rounded-[10px] border border-line bg-bg p-3 text-[13px] leading-relaxed text-navy"
        >
          {notice}
        </p>
      )}
      <p className="mt-0 mb-6 text-sm text-muted">
        Use your email and password to continue.
      </p>
      <AuthForm mode="login" action={loginAction} />
    </AuthShell>
  )
}
