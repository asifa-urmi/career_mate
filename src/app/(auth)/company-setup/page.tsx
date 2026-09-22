import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth/guards'
import { enforceAuthPage } from '@/lib/auth/enforce-auth-page'
import { Brand } from '@/components/layout'
import { CompanySetupForm } from '@/components/auth/company-setup-form'
import { completeCompanySetupAction } from '../onboarding/actions'

export const metadata: Metadata = { title: 'Set up your company — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function CompanySetupPage() {
  await requireUser()
  await enforceAuthPage('/company-setup')

  return (
    <div className="onboarding-bg min-h-screen px-4 py-9">
      <div className="mb-2 flex justify-center">
        <Brand />
      </div>
      <CompanySetupForm action={completeCompanySetupAction} />
    </div>
  )
}
