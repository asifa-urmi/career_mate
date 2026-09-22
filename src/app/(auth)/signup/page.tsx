import type { Metadata } from 'next'
import { enforceAuthPage } from '@/lib/auth/enforce-auth-page'
import { AuthShell } from '@/components/auth/auth-shell'
import { AuthForm } from '@/components/auth/auth-form'
import { signupAction } from '../actions'

export const metadata: Metadata = { title: 'Create an account — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function SignupPage() {
  await enforceAuthPage('/signup')

  return (
    <AuthShell
      eyebrow="Career + hiring workspace"
      headline="Create one profile. Explore every relevant sector."
      body="Technology, marketing, finance, healthcare, education and more — one account, without forcing your background into a software-skills template."
      proof={['Multi-sector jobs', 'CV intelligence', 'Application tracking']}
    >
      <h1 className="m-0 mb-1.5 font-display text-[30px] font-extrabold">Join CareerMate</h1>
      <p className="mt-0 mb-6 text-sm text-muted">
        Choose how you want to use the platform.
      </p>
      <AuthForm mode="signup" action={signupAction} />
    </AuthShell>
  )
}
