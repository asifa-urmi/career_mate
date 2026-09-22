import Link from 'next/link'
import type { JobCategory } from '@prisma/client'
import { Button, Card, Kicker } from '@/components/ui'
import { CATEGORIES } from '@/config/categories'
import { textGlyph } from '@/lib/utils/glyph'

export function SectionHeading({
  kicker,
  title,
  copy,
  onDark = false,
}: {
  kicker: string
  title: React.ReactNode
  copy?: string
  onDark?: boolean
}) {
  return (
    <>
      <Kicker className={onDark ? '!text-mint' : undefined}>{kicker}</Kicker>
      <h2 className="mt-2.5 mb-3 font-display text-[clamp(28px,4vw,44px)] leading-[1.08] font-extrabold">
        {title}
      </h2>
      {copy && (
        <p
          className={
            onDark
              ? 'm-0 max-w-[640px] text-base leading-[1.75] text-[#aebbd9]'
              : 'm-0 max-w-[640px] text-base leading-[1.75] text-muted'
          }
        >
          {copy}
        </p>
      )}
    </>
  )
}

export function StatsBar({
  sectorCount,
  jobCount,
}: {
  sectorCount: number
  jobCount: number
}) {
  const stats = [
    { value: `${sectorCount}`, label: 'career sectors in one platform' },
    { value: `${jobCount}`, label: jobCount === 1 ? 'live role right now' : 'live roles right now' },
    { value: '3', label: 'candidate, employer & admin workspaces' },
    { value: 'AI', label: 'match, CV, prep & hiring assist' },
  ]

  return (
    <div className="mx-auto -mt-10 grid w-[min(1180px,calc(100%-32px))] gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <Card key={s.label} padded className="text-center">
          <strong className="block font-display text-[30px] leading-none font-extrabold text-navy">
            {s.value}
          </strong>
          <span className="mt-2 block text-[13px] leading-snug text-muted">{s.label}</span>
        </Card>
      ))}
    </div>
  )
}

/** Live per-sector counts rather than the prototype's "More" placeholder. */
export function SectorGrid({ counts }: { counts: Partial<Record<JobCategory, number>> }) {
  return (
    <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {CATEGORIES.filter((c) => c.value !== 'OTHER').map((c) => {
        const count = counts[c.value] ?? 0
        return (
          <Link
            key={c.value}
            href={`/jobs-public?category=${c.value}`}
            className="rounded-[var(--radius-card)] border border-line bg-surface p-4.5 shadow-[var(--shadow-card-sm)] transition-all hover:-translate-y-0.5 hover:border-[#cbd8ff]"
          >
            <span className="block text-2xl" aria-hidden="true">
              {textGlyph(c.glyph)}
            </span>
            <b className="mt-2 block font-display text-sm">{c.label}</b>
            <small className="mt-0.5 block text-xs text-muted">
              {count === 0 ? 'No open roles yet' : `${count} open ${count === 1 ? 'role' : 'roles'}`}
            </small>
          </Link>
        )
      })}
    </div>
  )
}

const FEATURES = [
  ['⌕', 'Job discovery', 'Search and filter by sector, location, salary, experience, work mode and job type.'],
  ['▤', 'CV manager', 'Upload multiple CVs, choose a primary one and tailor for a target role.'],
  ['◉', 'Professional profile', 'Experience, education, skills, certifications, portfolio and visibility controls.'],
  ['✓', 'Guided application', 'Choose a CV, answer screening questions, review and submit.'],
  ['◫', 'Application tracker', 'Follow applied, screening, interview, assessment, offer and rejected stages.'],
  ['✦', 'AI career help', 'Match explanation, CV suggestions, cover-letter drafts, interview prep and skill-gap plans.'],
] as const

export function FeatureGrid() {
  return (
    <div className="mt-7 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map(([glyph, title, body]) => (
        <Card key={title} padded>
          <span
            className="grid size-11 place-items-center rounded-xl bg-blue-wash text-xl text-blue"
            aria-hidden="true"
          >
            {textGlyph(glyph)}
          </span>
          <h3 className="mt-3.5 mb-1.5 font-display text-base font-extrabold">{title}</h3>
          <p className="m-0 text-[13px] leading-relaxed text-muted">{body}</p>
        </Card>
      ))}
    </div>
  )
}

const AI_RESPONSIBILITIES = [
  ['Job match explainer', 'Shows evidence-backed strengths, gaps and preference alignment.'],
  ['CV tailoring', 'Suggests truthful improvements for a selected role.'],
  ['Application copilot', 'Drafts screening answers and cover letters from facts you provide.'],
  ['Interview practice', 'Generates sector-specific practice questions and feedback.'],
  ['Employer assistant', 'Improves job descriptions and summarises candidate evidence.'],
] as const

export function AiSection() {
  return (
    <section id="ai" className="bg-navy py-16 text-white">
      <div className="mx-auto grid w-[min(1180px,calc(100%-32px))] gap-10 lg:grid-cols-[1fr_1fr]">
        <div>
          <SectionHeading
            onDark
            kicker="AI with defined responsibilities"
            title="AI helps you decide and prepare. It does not invent qualifications."
            copy="Candidate AI is contextual to the profession and the job in front of you. Employer AI helps write structured roles and summarise evidence, while hiring decisions stay with people."
          />
          <Button href="/signup" variant="mint" className="mt-6">
            Open AI career assistant
          </Button>
        </div>

        <ul className="grid list-none gap-2.5 p-0">
          {AI_RESPONSIBILITIES.map(([title, body], i) => (
            <li key={title} className="flex items-start gap-3.5 rounded-2xl bg-white/5 p-3.5">
              <span
                className="grid size-9 shrink-0 place-items-center rounded-xl bg-mint/15 font-extrabold text-mint"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <div>
                <b className="block text-sm">{title}</b>
                <span className="mt-0.5 block text-[13px] leading-relaxed text-[#aebbd9]">
                  {body}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
