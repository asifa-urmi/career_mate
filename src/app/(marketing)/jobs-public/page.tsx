import Link from 'next/link'
import type { JobCategory } from '@prisma/client'
import { Card, CardTitle, Button, EmptyState } from '@/components/ui'
import { getCurrentUser } from '@/lib/auth/session'
import { PublicNav, Footer, PageHead } from '@/components/layout'
import { JobList } from '@/components/jobs/job-card'
import { CATEGORIES } from '@/config/categories'
import { countPublishedJobs, listPublishedJobs } from '@/lib/db/repositories/job.repository'
import { cn } from '@/lib/utils/cn'
import { textGlyph } from '@/lib/utils/glyph'

export const dynamic = 'force-dynamic'

const VALID_CATEGORIES = new Set(CATEGORIES.map((c) => c.value as string))

/**
 * The public job board. Anyone can read it; applying needs an account.
 *
 * The category filter comes from the query string, so an unknown or crafted value
 * must not reach the database as a bad enum — it is checked against the known set
 * and otherwise treated as "no filter".
 */
export default async function PublicJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>
}) {
  const params = await searchParams
  const category =
    params.category && VALID_CATEGORIES.has(params.category)
      ? (params.category as JobCategory)
      : undefined
  const search = params.q?.trim() || undefined

  const [user, jobs, total] = await Promise.all([
    getCurrentUser(),
    listPublishedJobs({ category, search }),
    countPublishedJobs(),
  ])

  return (
    <>
      <PublicNav user={user} />

      <div className="mx-auto w-[min(1180px,calc(100%-32px))] py-12">
        <PageHead
          title="Explore jobs"
          description={`${total} live ${total === 1 ? 'role' : 'roles'} across every sector. Sign in for AI ranking and applications.`}
        />

        <form className="mb-5 flex flex-wrap gap-2.5" role="search">
          <label htmlFor="q" className="sr-only">
            Search roles
          </label>
          <input
            id="q"
            name="q"
            defaultValue={search ?? ''}
            placeholder="Search by title, company or skill"
            className="min-w-60 flex-1 rounded-[var(--radius-field)] border border-line bg-surface px-3.5 py-3 text-sm outline-none focus:border-blue"
          />
          {category && <input type="hidden" name="category" value={category} />}
          <Button type="submit">Search</Button>
        </form>

        <div className="mb-6 flex flex-wrap gap-2">
          <CategoryPill href="/jobs-public" label="All sectors" glyph="◈" active={!category} />
          {CATEGORIES.map((c) => (
            <CategoryPill
              key={c.value}
              href={`/jobs-public?category=${c.value}`}
              label={c.label}
              glyph={c.glyph}
              active={category === c.value}
            />
          ))}
        </div>

        <div className="grid gap-4.5 lg:grid-cols-[1fr_320px]">
          <div>
            {jobs.length === 0 ? (
              <Card>
                <EmptyState
                  glyph="⌕"
                  title="No roles match that search"
                  body={
                    total === 0
                      ? 'No jobs have been published yet. Employers post them from their workspace.'
                      : 'Try a different sector, or clear the search to see everything.'
                  }
                  action={
                    <Button href="/jobs-public" variant="ghost">
                      Clear filters
                    </Button>
                  }
                />
              </Card>
            ) : (
              <JobList jobs={jobs} hrefFor={(job) => `/jobs-public/${job.id}`} />
            )}
          </div>

          <Card padded className="h-max lg:sticky lg:top-24">
            <CardTitle>Ready to apply?</CardTitle>
            <p className="m-0 mb-4 text-[13px] leading-relaxed text-muted">
              Create a candidate profile, upload your CV, and CareerMate can rank these roles
              against your actual background instead of showing them in date order.
            </p>
            <Button href="/signup" className="w-full">
              Create a free profile
            </Button>
          </Card>
        </div>
      </div>

      <Footer />
    </>
  )
}

function CategoryPill({
  href,
  label,
  glyph,
  active,
}: {
  href: string
  label: string
  glyph: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'rounded-[10px] border px-3 py-2 text-xs font-bold transition-colors',
        active
          ? 'border-[#c9d8ff] bg-blue-wash text-blue'
          : 'border-line bg-surface text-[#58617a] hover:border-[#cbd8ff]',
      )}
    >
      <span aria-hidden="true">{textGlyph(glyph)}</span> {label}
    </Link>
  )
}
