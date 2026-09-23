import type { Metadata } from 'next'
import Link from 'next/link'
import { requireGroup } from '@/lib/auth/require-group'
import { PageHead } from '@/components/layout'
import { Avatar, Badge, Card, CardTitle, Progress, SkillTag } from '@/components/ui'
import {
  BasicsSection,
  EntrySection,
  Field,
  Input,
  SkillsSection,
  Textarea,
} from '@/components/profile/profile-sections'
import { candidateProfileIdFor } from '@/lib/db/repositories/saved-job.repository'
import { getCandidateProfile } from '@/lib/db/repositories/candidate.repository'
import { missingProfileSignals, profileCompleteness } from '@/lib/profile/completeness'
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
            <Avatar name={user.name} size={84} className="ring-4 ring-white" />
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

          <EntrySection
            title="Work experience"
            addLabel="+ Add a role"
            kind="experience"
            action={saveExperienceAction}
            entries={(profile?.experiences ?? []).map((e) => ({
              id: e.id,
              primary: e.title,
              secondary: e.company,
              tertiary: `${monthYear(e.startDate)} — ${e.isCurrent ? 'Present' : monthYear(e.endDate)}`,
            }))}
          >
            {(state) => (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Job title" htmlFor="title" error={state.fieldErrors?.title} required>
                    <Input id="title" name="title" placeholder="Accounts Officer" />
                  </Field>
                  <Field label="Company" htmlFor="company" error={state.fieldErrors?.company} required>
                    <Input id="company" name="company" placeholder="Meridian Group" />
                  </Field>
                  <Field label="Started" htmlFor="startDate" error={state.fieldErrors?.startDate} required>
                    <Input id="startDate" name="startDate" type="date" />
                  </Field>
                  <Field label="Ended" htmlFor="endDate" error={state.fieldErrors?.endDate}>
                    <Input id="endDate" name="endDate" type="date" />
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" name="isCurrent" className="size-4 accent-[var(--color-blue)]" />
                  I still work here
                </label>
                <Field label="What you did" htmlFor="description" error={state.fieldErrors?.description}>
                  <Textarea id="description" name="description" rows={3} />
                </Field>
              </>
            )}
          </EntrySection>

          <EntrySection
            title="Education"
            addLabel="+ Add education"
            kind="education"
            action={saveEducationAction}
            entries={(profile?.educations ?? []).map((e) => ({
              id: e.id,
              primary: e.degree,
              secondary: e.institution,
              tertiary: e.endDate ? monthYear(e.endDate) : undefined,
            }))}
          >
            {(state) => (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Degree" htmlFor="degree" error={state.fieldErrors?.degree} required>
                  <Input id="degree" name="degree" placeholder="BBA in Accounting" />
                </Field>
                <Field
                  label="Institution"
                  htmlFor="institution"
                  error={state.fieldErrors?.institution}
                  required
                >
                  <Input id="institution" name="institution" placeholder="Dhaka University" />
                </Field>
                <Field label="Started" htmlFor="startDate" error={state.fieldErrors?.startDate}>
                  <Input id="startDate" name="startDate" type="date" />
                </Field>
                <Field label="Finished" htmlFor="endDate" error={state.fieldErrors?.endDate}>
                  <Input id="endDate" name="endDate" type="date" />
                </Field>
              </div>
            )}
          </EntrySection>

          <SkillsSection action={saveSkillsAction} skills={profile?.skills ?? []} />

          <EntrySection
            title="Links"
            addLabel="+ Add a link"
            kind="link"
            action={saveLinkAction}
            entries={(profile?.links ?? []).map((l) => ({
              id: l.id,
              primary: l.label,
              secondary: l.url,
            }))}
          >
            {(state) => (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" htmlFor="label" error={state.fieldErrors?.label} required>
                  <Input id="label" name="label" placeholder="Portfolio" />
                </Field>
                <Field label="Address" htmlFor="url" error={state.fieldErrors?.url} required>
                  <Input id="url" name="url" placeholder="https://example.com" />
                </Field>
              </div>
            )}
          </EntrySection>
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
