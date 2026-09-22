import { Badge, Button, Card } from '@/components/ui'
import { categoryLabel } from '@/config/categories'
import type { JobCardModel } from '@/lib/db/repositories/job.repository'

/**
 * The landing hero, with the prototype's mock product window: two floating
 * chips, a navy top-match card and three compressed job rows.
 *
 * The rows are real seeded jobs rather than hardcoded copy, so the screenshot a
 * visitor sees matches what they get after signing up.
 */
export function Hero({ previewJobs }: { previewJobs: readonly JobCardModel[] }) {
  const top = previewJobs[0]
  const rest = previewJobs.slice(1, 4)

  return (
    <section className="overflow-hidden bg-[linear-gradient(180deg,#ffffff,var(--color-bg))] pt-14 pb-20">
      <div className="mx-auto grid w-[min(1180px,calc(100%-32px))] items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <Badge tone="mint" dot>
            AI-powered job &amp; hiring platform
          </Badge>

          <h1 className="mt-4 mb-4 font-display text-[clamp(34px,5vw,54px)] leading-[1.05] font-extrabold">
            One career platform for <span className="text-blue">every profession.</span>
          </h1>

          <p className="m-0 max-w-[560px] text-base leading-[1.75] text-muted">
            Discover jobs, apply with the right CV, build a professional profile, track
            applications and use AI for role matching, resume improvement and interview
            preparation — across technology, business, creative, service, healthcare and
            education careers.
          </p>

          <div className="mt-7 flex flex-wrap gap-2.5">
            <Button href="/signup">Find jobs →</Button>
            <Button href="/jobs-public" variant="dark">
              Browse without an account
            </Button>
          </div>

          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-semibold text-muted">
            <span>✓ Multi-sector job discovery</span>
            <span>✓ CV &amp; profile intelligence</span>
            <span>✓ Candidate + employer workspaces</span>
          </div>
        </div>

        <div className="relative">
          <span className="absolute -top-3 left-4 z-10 rounded-full bg-surface px-3 py-2 text-[11px] font-extrabold text-blue shadow-[var(--shadow-card-sm)]">
            ✦ AI-ranked matches
          </span>
          <span className="absolute -bottom-3 right-4 z-10 rounded-full bg-surface px-3 py-2 text-[11px] font-extrabold text-mint-ink shadow-[var(--shadow-card-sm)]">
            ✓ Application ready
          </span>

          <Card className="overflow-hidden shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between border-b border-line px-4.5 py-3.5">
              <b className="text-sm">Recommended for you</b>
              <Badge tone="mint">AI ranked</Badge>
            </div>

            <div className="grid grid-cols-[52px_1fr] gap-3.5 p-3.5">
              <div className="grid content-start gap-1.5" aria-hidden="true">
                <span className="block h-2.5 rounded bg-blue" />
                <span className="block h-2.5 rounded bg-line" />
                <span className="block h-2.5 rounded bg-line" />
                <span className="block h-2.5 rounded bg-line" />
                <span className="block h-2.5 rounded bg-line" />
              </div>

              <div className="grid gap-2.5">
                {top && (
                  <div className="rounded-2xl bg-[linear-gradient(135deg,var(--color-navy),#19397c)] p-4 text-white">
                    <small className="text-[10px] font-extrabold tracking-[0.12em] text-[#9fb4e8] uppercase">
                      Top match today
                    </small>
                    <div className="font-display text-[34px] leading-none font-extrabold text-mint">
                      92%
                    </div>
                    <b className="text-sm">{top.title}</b>
                    <p className="m-0 mt-1.5 text-xs text-[#cbd6ed]">
                      Skills, location and experience align strongly.
                    </p>
                  </div>
                )}

                {rest.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between gap-2.5 rounded-xl border border-line px-2.5 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#eff3ff] text-[10px] font-extrabold text-blue">
                        {job.logoInitials}
                      </span>
                      <div className="min-w-0">
                        <b className="block truncate text-xs">{job.title}</b>
                        <span className="block truncate text-[10px] text-muted">
                          {categoryLabel(job.category)} · {job.companyName}
                        </span>
                      </div>
                    </div>
                    <Badge tone="mint">{job.postedLabel}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  )
}
