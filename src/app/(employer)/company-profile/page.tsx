import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireGroup } from '@/lib/auth/require-group'
import { PageHead } from '@/components/layout'
import { Badge, Card, CardTitle, CompanyMark, MetricCard } from '@/components/ui'
import { CompanyProfileForm } from '@/components/employer/company-profile-form'
import { getCompanyProfile } from '@/server/services/company.service'
import { companyInitials } from '@/lib/utils/company'
import { categoryLabel } from '@/config/categories'
import { saveCompanyAction } from './actions'

export const metadata: Metadata = { title: 'Company profile — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function CompanyProfilePage() {
  const user = await requireGroup('employer')
  const employer = await getCompanyProfile(user.id)
  if (!employer) notFound()

  const { company } = employer

  return (
    <>
      <PageHead
        title="Company profile"
        description="Candidates read this on every role you post."
      />

      <div className="grid gap-4.5 lg:grid-cols-[1fr_300px]">
        <CompanyProfileForm
          action={saveCompanyAction}
          values={{
            companyName: company.name,
            sector: company.sector,
            size: company.size ?? '',
            website: company.website ?? '',
            location: company.location ?? '',
            about: company.about ?? '',
            title: employer.title ?? '',
          }}
        />

        <div className="grid content-start gap-4.5">
          <Card padded>
            <CardTitle>How it looks</CardTitle>
            <div className="flex items-start gap-3">
              <CompanyMark
                initials={companyInitials(company.name)}
                size={48}
                className="bg-[linear-gradient(145deg,#dce6ff,#eff3ff)] !text-blue"
              />
              <div className="min-w-0">
                <b className="block text-sm">{company.name}</b>
                <span className="block text-xs text-muted">
                  {categoryLabel(company.sector)}
                  {company.location && ` · ${company.location}`}
                </span>
                <div className="mt-1.5">
                  {company.verified ? (
                    <Badge tone="mint">Verified</Badge>
                  ) : (
                    <Badge tone="dark">Not verified</Badge>
                  )}
                </div>
              </div>
            </div>
            {!company.verified && (
              <p className="m-0 mt-3.5 text-xs leading-relaxed text-muted">
                Verification is granted by the platform, not from this page — a badge a company
                could tick itself would mean nothing. Contact support to request it.
              </p>
            )}
          </Card>

          <MetricCard label="Roles posted" value={company._count.jobs} />
          <MetricCard label="People on this company" value={company._count.employers} />
        </div>
      </div>
    </>
  )
}
