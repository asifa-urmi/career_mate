'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/guards'
import { companySetupSchema } from '@/lib/validation/onboarding.schema'
import { updateCompanyProfile } from '@/server/services/company.service'

export type CompanyFormState = {
  fieldErrors?: Record<string, string[]>
  formError?: string
  saved?: boolean
}

export async function saveCompanyAction(
  _prev: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  const user = await requireUser()

  const parsed = companySetupSchema.safeParse({
    companyName: String(formData.get('companyName') ?? ''),
    sector: String(formData.get('sector') ?? ''),
    size: String(formData.get('size') ?? ''),
    website: String(formData.get('website') ?? ''),
    location: String(formData.get('location') ?? ''),
    about: String(formData.get('about') ?? ''),
    title: String(formData.get('title') ?? ''),
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form')
      fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message]
    }
    return { fieldErrors }
  }

  const result = await updateCompanyProfile(user, parsed.data)
  if (!result.ok) return { formError: result.error.message }

  revalidatePath('/company-profile')
  revalidatePath('/employer')
  return { saved: true }
}
