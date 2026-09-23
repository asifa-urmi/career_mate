import { Button } from '@/components/ui'
import { getCurrentUser } from '@/lib/auth/session'
import { PublicNav, Footer } from '@/components/layout'
import { Hero } from '@/components/marketing/hero'
import {
  AiSection,
  FeatureGrid,
  SectionHeading,
  SectorGrid,
  StatsBar,
} from '@/components/marketing/sections'
import { CATEGORIES } from '@/config/categories'
import {
  countJobsByCategory,
  countPublishedJobs,
  listPublishedJobs,
} from '@/lib/db/repositories/job.repository'

// Reads the database, so it renders per request rather than being baked at build
// time — the sector counts and preview roles must reflect what is actually live.
export const dynamic = 'force-dynamic'

export default async function LandingPage() {
  const [user, previewJobs, counts, jobCount] = await Promise.all([
    getCurrentUser(),
    listPublishedJobs({ take: 4 }),
    countJobsByCategory(),
    countPublishedJobs(),
  ])

  return (
    <>
      <PublicNav showSectionLinks user={user} />

      <Hero previewJobs={previewJobs} />
      <StatsBar sectorCount={CATEGORIES.length - 1} jobCount={jobCount} />

      <section id="sectors" className="py-16">
        <div className="mx-auto w-[min(1180px,calc(100%-32px))]">
          <SectionHeading
            kicker="Not engineering-only"
            title="Search by profession, sector and work style."
            copy="The same platform serves technical and non-technical candidates without forcing every profile into a software-skills template."
          />
          <SectorGrid counts={counts} />
        </div>
      </section>

      <section id="features" className="pb-16">
        <div className="mx-auto w-[min(1180px,calc(100%-32px))]">
          <SectionHeading
            kicker="Candidate workspace"
            title="From account creation to application outcome."
          />
          <FeatureGrid />
        </div>
      </section>

      <AiSection />

      <section id="employers" className="py-16">
        <div className="mx-auto w-[min(1180px,calc(100%-32px))]">
          <SectionHeading
            kicker="Employer workspace"
            title="Post any type of role and manage the whole hiring pipeline."
            copy="Choose a sector, define role-specific requirements, review candidates, shortlist, interview, message, analyse funnel performance and maintain a company profile."
          />
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Button href="/signup" variant="dark">
              Create an employer account
            </Button>
            <Button href="/jobs-public" variant="ghost">
              See live roles
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}
