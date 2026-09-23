import type { Metadata } from 'next'
import Link from 'next/link'
import { requireGroup } from '@/lib/auth/require-group'
import { PageHead } from '@/components/layout'
import { Badge, Card, CardTitle, Progress, SkillTag } from '@/components/ui'
import { BasicsSection, SkillsSection } from '@/components/profile/profile-sections'
import {
  EducationSection,
  ExperienceSection,
  LinkSection,
} from '@/components/profile/entry-forms'
import { candidateProfileIdFor } from '@/lib/db/repositories/saved-job.repository'
import { getCandidateProfile } from '@/lib/db/repositories/candidate.repository'
import { missingProfileSignals, profileCompleteness } from '@/lib/profile/completeness'
import { AvatarControl } from '@/components/profile/avatar-control'
import { categoryLabel } from '@/config/categories'
import { EXPERIENCE_LEVELS } from '@/config/constants'
import {
  saveBasicsAction,
  saveEducationAction,
  saveExperienceAction,
  saveLinkAction,
  saveSkillsAction,
} from './actions'

export const metadata: Metadata = { title: 'Profile — CareerMate' }
export const dynamic = 'force-dynamic'

const LEVEL_LABEL = new Map(EXPERIENCE_LEVELS.map((l) => [l.value, l.label]))

function monthYear(date: Date | null): string {
  if (!date) return ''
  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

/** `<input type="date">` wants YYYY-MM-DD, not a locale string. */
function dateInput(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : ''
}

export default async function ProfilePage() {
  const user = await requireGroup('candidate')
  const profileId = await candidateProfileIdFor(user.id)
  const profile = profileId ? await getCandidateProfile(profileId) : null

  const forCompleteness = profile
    ? {
        headline: profile.headline,
        location: profile.location,
        bio: profile.bio,
        preference: profile.preference,
        counts: {
          experiences: profile.experiences.length,
          educations: profile.educations.length,
          skills: profile.skills.length,
          resumes: profile.resumeCount,
        },
      }
    : null

  const completeness = profileCompleteness(forCompleteness)
  const missing = missingProfileSignals(forCompleteness)

  return (
    <>
      <PageHead
        title="Profile"
        description="This is what an employer sees when you apply."
      />

      <Card className="mb-4.5 overflow-hidden">
        <div className="profile-cover h-[150px]" />
        <div className="relative px-6 pt-0 pb-6">
          <div className="-mt-10 mb-3">
            <AvatarControl name={user.name} src={user.avatarUrl} />
          </div>
          <h2 className="m-0 mb-1 font-display text-2xl font-extrabold">{user.name}</h2>
          <p className="m-0 text-sm text-muted">
            {profile?.headline ?? 'Add a headline so employers know what you do'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {profile && (
              <>
                <Badge tone="dark">{categoryLabel(profile.primarySector)}</Badge>
                <Badge tone="dark">
                  {LEVEL_LABEL.get(profile.experienceLevel) ?? profile.experienceLevel}
                </Badge>
              </>
            )}
            {profile?.location && <Badge tone="dark">{profile.location}</Badge>}
          </div>
        </div>
      </Card>

      <div className="grid gap-4.5 lg:grid-cols-[1fr_300px]">
        <div className="grid gap-4.5">
          <BasicsSection
            action={saveBasicsAction}
            values={{
              headline: profile?.headline ?? '',
              location: profile?.location ?? '',
              bio: profile?.bio ?? '',
              experienceLevel: profile?.experienceLevel ?? 'ENTRY',
              primarySector: profile?.primarySector ?? 'OTHER',
            }}
          />

          <ExperienceSection
            action={saveExperienceAction}
            entries={(profile?.experiences ?? []).map((e) => ({
              id: e.id,
              primary: e.title,
              secondary: e.company,
              tertiary: `${monthYear(e.startDate)} — ${e.isCurrent ? 'Present' : monthYear(e.endDate)}`,
              values: {
                title: e.title,
                company: e.company,
                startDate: dateInput(e.startDate),
                endDate: dateInput(e.endDate),
                isCurrent: e.isCurrent,
                description: e.description ?? '',
              },
            }))}
          />

          <EducationSection
            action={saveEducationAction}
            entries={(profile?.educations ?? []).map((e) => ({
              id: e.id,
              primary: e.degree,
              secondary: e.institution,
              tertiary: e.endDate ? monthYear(e.endDate) : undefined,
              values: {
                degree: e.degree,
                institution: e.institution,
                startDate: dateInput(e.startDate),
                endDate: dateInput(e.endDate),
              },
            }))}
          />

          <SkillsSection action={saveSkillsAction} skills={profile?.skills ?? []} />

          <LinkSection
            action={saveLinkAction}
            entries={(profile?.links ?? []).map((l) => ({
              id: l.id,
              primary: l.label,
              secondary: l.url,
              values: { label: l.label, url: l.url },
            }))}
          />
        </div>

        <div className="grid content-start gap-4.5">
          <Card padded>
            <CardTitle>Profile strength</CardTitle>
            <strong className="mb-2 block font-display text-[28px] leading-none">
              {completeness}%
            </strong>
            <Progress value={completeness} label="Profile completeness" />

            {missing.length > 0 ? (
              <>
                <p className="mt-4 mb-2 text-xs font-bold text-navy">Still missing</p>
                <ul className="grid list-none gap-1.5 p-0">
                  {missing.map((signal) => (
                    <li key={signal.label} className="text-[13px] text-muted">
                      · {signal.label}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-4 mb-0 text-[13px] leading-relaxed text-muted">
                Every section is filled in.
              </p>
            )}
          </Card>

          {(profile?.skills.length ?? 0) > 0 && (
            <Card padded>
              <CardTitle>At a glance</CardTitle>
              <div className="flex flex-wrap gap-1.5">
                {profile?.skills.map((s) => (
                  <SkillTag key={s}>{s}</SkillTag>
                ))}
              </div>
            </Card>
          )}

          {(profile?.links.length ?? 0) > 0 && (
            <Card padded>
              <CardTitle>Links</CardTitle>
              <ul className="grid list-none gap-1.5 p-0">
                {profile?.links.map((l) => (
                  <li key={l.id}>
                    {/* rel is not optional: a profile link is user-supplied and
                        opens in a new tab, so the target must not get a handle
                        back to this window. */}
                    <Link
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-[13px] font-semibold text-blue hover:underline"
                    >
                      {l.label} ↗
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
