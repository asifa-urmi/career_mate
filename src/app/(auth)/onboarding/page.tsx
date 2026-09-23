import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth/guards'
import { enforceAuthPage } from '@/lib/auth/enforce-auth-page'
import { Brand } from '@/components/layout'
import { OnboardingWizard } from '@/components/auth/onboarding-wizard'
import { completeOnboardingAction } from './actions'

export const metadata: Metadata = { title: 'Set up your profile — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  await requireUser()
  await enforceAuthPage('/onboarding')

  return (
    <div className="onboarding-bg min-h-screen px-4 py-9">
      <div className="mb-2 flex justify-center">
        <Brand />
      </div>
      <OnboardingWizard action={completeOnboardingAction} />
    </div>
  )
}
