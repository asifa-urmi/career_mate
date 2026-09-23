import type { Metadata } from 'next'
import Link from 'next/link'
import type { JobCategory } from '@prisma/client'
import { requireGroup } from '@/lib/auth/require-group'
import { PageHead } from '@/components/layout'
import { Button, Card, CardTitle, EmptyState } from '@/components/ui'
import { JobList } from '@/components/jobs/job-card'
import { SaveButton } from '@/components/jobs/save-button'
import {
  candidateProfileIdFor,
  savedJobIds,
} from '@/lib/db/repositories/saved-job.repository'
import { matchScoresFor } from '@/lib/matching/match-for'
import { CATEGORIES } from '@/config/categories'
import { countPublishedJobs, listPublishedJobs } from '@/lib/db/repositories/job.repository'
import { cn } from '@/lib/utils/cn'
import { textGlyph } from '@/lib/utils/glyph'

export const metadata: Metadata = { title: 'Find jobs — CareerMate' }
export const dynamic = 'force-dynamic'

const VALID_CATEGORIES = new Set(CATEGORIES.map((c) => c.value as string))

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>
}) {
  const user = await requireGroup('candidate')

  const params = await searchParams
  // A crafted query string must not reach Prisma as an invalid enum.
  const category =
    params.category && VALID_CATEGORIES.has(params.category)
      ? (params.category as JobCategory)
      : undefined
  const search = params.q?.trim() || undefined

  const profileId = await candidateProfileIdFor(user.id)
  const [listed, total, saved] = await Promise.all([
    listPublishedJobs({ category, search }),
    countPublishedJobs(),
    profileId ? savedJobIds(profileId) : Promise.resolve(new Set<string>()),
  ])

  // Scored in one pass — the profile is fetched once and reused across every
  // job, so ranking fifty roles is two queries rather than fifty-one.
  const scores = profileId
    ? await matchScoresFor(profileId, listed.map((j) => j.id))
    : new Map<string, number>()

  const ranked = scores.size > 0
  const jobs = ranked
    ? listed
        .map((job) => ({ ...job, score: scores.get(job.id) ?? 0 }))
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    : listed

  return (
    <>
      <PageHead
        title="Find jobs"
        description={`${total} live ${total === 1 ? 'role' : 'roles'} across every sector.`}
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
        <Pill href="/jobs" label="All sectors" glyph="◈" active={!category} />
        {CATEGORIES.map((c) => (
          <Pill
            key={c.value}
            href={`/jobs?category=${c.value}`}
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
                    ? 'No jobs have been published yet. Check back shortly.'
                    : 'Try a different sector, or clear the search to see everything.'
                }
                action={
                  <Button href="/jobs" variant="ghost">
                    Clear filters
                  </Button>
                }
              />
            </Card>
          ) : (
            <JobList
              jobs={jobs}
              hrefFor={(job) => `/jobs/${job.id}`}
              actionFor={(job) => (
                <SaveButton jobId={job.id} saved={saved.has(job.id)} label={false} />
              )}
            />
          )}
        </div>

        <Card padded className="h-max lg:sticky lg:top-24">
          <CardTitle>Ranking</CardTitle>
          {ranked ? (
            <p className="m-0 text-[13px] leading-relaxed text-muted">
              Ranked against your profile — skills, sector, location and salary. The score is
              calculated here, not by AI, so it does not change when a provider is busy. Open a
              role to see the breakdown.
            </p>
          ) : (
            <p className="m-0 text-[13px] leading-relaxed text-muted">
              Newest first. Fill in your profile and these will be ranked against your actual
              background instead.
            </p>
          )}
        </Card>
      </div>
    </>
  )
}

function Pill({
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
