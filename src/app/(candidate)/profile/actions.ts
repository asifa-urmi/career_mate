'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/guards'
import { attachedFile } from '@/lib/validation/attached-file'
import { removeAvatar, updateAvatar } from '@/server/services/avatar.service'
import {
  basicsSchema,
  educationSchema,
  experienceSchema,
  linksSchema,
  skillsSchema,
} from '@/lib/validation/profile.schema'
import {
  deleteEducation,
  deleteExperience,
  deleteLink,
  setSkills,
  updateBasics,
  upsertEducation,
  upsertExperience,
  upsertLink,
} from '@/server/services/profile.service'

export type ProfileFormState = {
  fieldErrors?: Record<string, string[]>
  formError?: string
  saved?: boolean
}

function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string[]> = {}
  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form')
    out[key] = [...(out[key] ?? []), issue.message]
  }
  return out
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '')
}

function revalidateProfile() {
  revalidatePath('/profile')
  // The dashboard's completeness meter reads the same signals.
  revalidatePath('/dashboard')
}

/**
 * Role and ownership are checked in the services. These actions parse, delegate
 * and revalidate — a server action is a public endpoint and the layout that
 * guards its page never runs for it.
 */
export async function saveBasicsAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await requireUser()

  const parsed = basicsSchema.safeParse({
    headline: text(formData, 'headline'),
    location: text(formData, 'location'),
    bio: text(formData, 'bio'),
    experienceLevel: text(formData, 'experienceLevel'),
    primarySector: text(formData, 'primarySector'),
  })
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues) }

  const result = await updateBasics(user, parsed.data)
  if (!result.ok) return { formError: result.error.message }

  revalidateProfile()
  return { saved: true }
}

export async function saveExperienceAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await requireUser()

  const parsed = experienceSchema.safeParse({
    id: text(formData, 'id'),
    title: text(formData, 'title'),
    company: text(formData, 'company'),
    startDate: text(formData, 'startDate'),
    endDate: text(formData, 'endDate'),
    isCurrent: formData.get('isCurrent') === 'on',
    description: text(formData, 'description'),
  })
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues) }

  const result = await upsertExperience(user, parsed.data)
  if (!result.ok) return { formError: result.error.message }

  revalidateProfile()
  return { saved: true }
}

export async function saveEducationAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await requireUser()

  const parsed = educationSchema.safeParse({
    id: text(formData, 'id'),
    degree: text(formData, 'degree'),
    institution: text(formData, 'institution'),
    fieldOfStudy: text(formData, 'fieldOfStudy'),
    startDate: text(formData, 'startDate'),
    endDate: text(formData, 'endDate'),
    grade: text(formData, 'grade'),
  })
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues) }

  const result = await upsertEducation(user, parsed.data)
  if (!result.ok) return { formError: result.error.message }

  revalidateProfile()
  return { saved: true }
}

export async function saveSkillsAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await requireUser()

  const parsed = skillsSchema.safeParse({ skills: text(formData, 'skills') })
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues) }

  const result = await setSkills(user, parsed.data)
  if (!result.ok) return { formError: result.error.message }

  revalidateProfile()
  return { saved: true }
}

export async function saveLinkAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await requireUser()

  const parsed = linksSchema.safeParse({
    id: text(formData, 'id'),
    label: text(formData, 'label'),
    url: text(formData, 'url'),
  })
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues) }

  const result = await upsertLink(user, parsed.data)
  if (!result.ok) return { formError: result.error.message }

  revalidateProfile()
  return { saved: true }
}

export async function deleteEntryAction(
  kind: 'experience' | 'education' | 'link',
  id: string,
): Promise<{ error?: string }> {
  const user = await requireUser()

  const result =
    kind === 'experience'
      ? await deleteExperience(user, id)
      : kind === 'education'
        ? await deleteEducation(user, id)
        : await deleteLink(user, id)

  if (!result.ok) return { error: result.error.message }

  revalidateProfile()
  return {}
}

export type AvatarState = { error?: string; saved?: string }

/**
 * The profile photo. Acts on the caller and takes no user id, so there is
 * nothing in the request naming whose photo to change.
 */
export async function updateAvatarAction(
  _prev: AvatarState,
  formData: FormData,
): Promise<AvatarState> {
  const user = await requireUser()

  const file = attachedFile(formData.get('avatar'))
  if (!file) return { error: 'Choose an image first.' }

  const result = await updateAvatar(user, {
    fileName: file.name,
    mimeType: file.type,
    bytes: new Uint8Array(await file.arrayBuffer()),
  })

  if (!result.ok) return { error: result.error.message }

  revalidatePath('/', 'layout')
  return { saved: 'Photo updated.' }
}

export async function removeAvatarAction(): Promise<AvatarState> {
  const user = await requireUser()
  const result = await removeAvatar(user)

  if (!result.ok) return { error: result.error.message }

  revalidatePath('/', 'layout')
  return { saved: 'Photo removed.' }
}
