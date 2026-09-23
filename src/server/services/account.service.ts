import 'server-only'

import type { NotificationType } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { createAdminSupabase, createServerSupabase } from '@/lib/supabase/server'
import { deleteResumeFile } from '@/lib/supabase/storage'
import { appError } from '@/lib/utils/errors'
import { err, ok, type Result } from '@/lib/utils/result'
import type { SessionUser } from '@/lib/auth/session'

/**
 * Account settings.
 *
 * Everything here acts on the caller and takes no user id, so there is nothing
 * to tamper with: you cannot change an account you are not signed in as, because
 * the target is never in the request.
 */

export async function changeEmail(user: SessionUser, email: string): Promise<Result<void>> {
  const next = email.trim().toLowerCase()
  if (!next || !next.includes('@')) {
    return err(appError('VALIDATION', 'Enter a valid email address.'))
  }
  if (next === user.email) return ok(undefined)

  // Checked before asking Supabase, so the person gets a readable message
  // instead of a provider error, and nothing is half-changed.
  const taken = await prisma.user.findFirst({
    where: { email: next, id: { not: user.id } },
    select: { id: true },
  })
  if (taken) {
    return err(appError('CONFLICT', 'Another account already uses that email address.'))
  }

  try {
    const supabase = await createServerSupabase()
    const { error } = await supabase.auth.updateUser({ email: next })

    if (error) {
      const message = error.message.toLowerCase()
      if (message.includes('already') || message.includes('registered')) {
        return err(appError('CONFLICT', 'Another account already uses that email address.'))
      }
      return err(appError('INTERNAL', 'We could not change your email. Please try again.'))
    }

    // Our row is deliberately NOT written here. Supabase only switches the auth
    // email once the confirmation link is clicked, so writing ours first made
    // the two disagree for as long as the link went unclicked — and
    // `changePassword` re-authenticates by email, so an unconfirmed change used
    // to lock the person out of their own password permanently.
    //
    // `getCurrentUser` reconciles our row from the auth user on the next page
    // load, which is where the confirmation actually lands.
    return ok(undefined)
  } catch {
    return err(appError('INTERNAL', 'We could not change your email. Please try again.'))
  }
}

export async function changePassword(
  user: SessionUser,
  currentPassword: string,
  newPassword: string,
): Promise<Result<void>> {
  if (newPassword.length < 8) {
    return err(appError('VALIDATION', 'Use at least 8 characters.'))
  }
  if (!currentPassword) {
    return err(appError('VALIDATION', 'Enter your current password.'))
  }

  try {
    const supabase = await createServerSupabase()

    // The address Supabase holds, which is the one it will authenticate. Ours
    // can lag it while an email change is waiting to be confirmed.
    const { data: authUser } = await supabase.auth.getUser()
    const email = authUser?.user?.email ?? user.email

    // Re-authenticating proves the person at the keyboard is the account holder
    // and not someone who found an unlocked laptop.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    })
    if (signInError) {
      return err(appError('UNAUTHENTICATED', 'That is not your current password.'))
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      return err(appError('INTERNAL', 'We could not change your password. Please try again.'))
    }

    return ok(undefined)
  } catch {
    return err(appError('INTERNAL', 'We could not change your password. Please try again.'))
  }
}

export async function updateNotificationPreferences(
  user: SessionUser,
  types: NotificationType[],
): Promise<Result<void>> {
  const allowed: NotificationType[] = [
    'APPLICATION_UPDATE',
    'NEW_MESSAGE',
    'JOB_MATCH',
    'SYSTEM',
  ]
  const clean = [...new Set(types)].filter((t) => allowed.includes(t))

  try {
    await prisma.user.update({ where: { id: user.id }, data: { notifyOn: clean } })
    return ok(undefined)
  } catch {
    return err(appError('INTERNAL', 'We could not save that. Please try again.'))
  }
}

/**
 * Everything the platform holds about the caller, as JSON.
 *
 * Only their own rows: the query starts at their user id and walks outward, so
 * there is no wider result to filter down from and no way to widen it.
 */
export async function exportMyData(user: SessionUser): Promise<Result<unknown>> {
  try {
    const data = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        notifyOn: true,
        candidateProfile: {
          select: {
            headline: true,
            location: true,
            bio: true,
            experienceLevel: true,
            primarySector: true,
            preference: true,
            experiences: true,
            educations: true,
            skills: { select: { name: true } },
            certifications: true,
            links: true,
            resumes: {
              select: { label: true, fileName: true, sizeBytes: true, createdAt: true },
            },
            applications: {
              select: {
                createdAt: true,
                stage: true,
                coverLetter: true,
                screeningAnswers: true,
                job: { select: { title: true, company: { select: { name: true } } } },
                events: { select: { fromStage: true, toStage: true, createdAt: true } },
              },
            },
            savedJobs: { select: { createdAt: true, job: { select: { title: true } } } },
          },
        },
        employerProfile: { select: { title: true, company: { select: { name: true } } } },
        notifications: { select: { type: true, title: true, body: true, createdAt: true } },
        sentMessages: { select: { body: true, createdAt: true } },
      },
    })

    if (!data) return err(appError('NOT_FOUND', 'We could not find your account.'))

    return ok({ exportedAt: new Date().toISOString(), account: data })
  } catch {
    return err(appError('INTERNAL', 'We could not build your export. Please try again.'))
  }
}

/**
 * Deletes the caller's account.
 *
 * Typed confirmation, because this is the one action on the platform that
 * cannot be undone. The cascades in the schema take the profile, applications,
 * saved jobs, CV rows and messages with it.
 *
 * Three things live outside those cascades and are handled here in order:
 *
 *  - the CV files in the storage bucket. A row is not the CV; the file is, and
 *    it holds a name, a phone number and often an address. Their paths are read
 *    before the row goes, because afterwards there is nothing left to read them
 *    from.
 *  - the Supabase auth identity. Left behind, it bricks the email address: a
 *    fresh signup is refused as already registered and a sign-in is refused for
 *    having no profile, with no way out of either.
 *  - the session cookie.
 *
 * The auth user is deleted last, so a failure there leaves an account that is
 * already gone from the application rather than an application row with no way
 * to sign in. That failure is reported, not swallowed: a partial deletion the
 * person is told succeeded is worse than one they can ask about.
 */
export async function deleteMyAccount(
  user: SessionUser,
  confirmation: string,
): Promise<Result<void>> {
  if (confirmation.trim().toUpperCase() !== 'DELETE') {
    return err(appError('VALIDATION', 'Type DELETE to confirm.'))
  }

  // An admin deleting themselves could leave the platform with no usable
  // administrator and no way to appoint one. A suspended admin cannot sign in,
  // so they do not count towards the ones who could.
  if (user.role === 'ADMIN') {
    const admins = await prisma.user.count({
      where: { role: 'ADMIN', suspendedAt: null, id: { not: user.id } },
    })
    if (admins < 1) {
      return err(
        appError('CONFLICT', 'You are the last administrator. Appoint another one first.'),
      )
    }
  }

  let storagePaths: string[] = []

  try {
    const resumes = await prisma.resume.findMany({
      where: { candidateProfile: { userId: user.id } },
      select: { storagePath: true },
    })
    storagePaths = resumes.map((r) => r.storagePath)

    await prisma.user.delete({ where: { id: user.id } })
  } catch {
    return err(appError('INTERNAL', 'We could not delete your account. Please try again.'))
  }

  // Past the point of no return. Anything that fails from here has already lost
  // the account, so each step is attempted independently and the person is told
  // plainly if one did not finish.
  for (const path of storagePaths) {
    try {
      await deleteResumeFile(path)
    } catch {
      // The row is gone either way; an orphaned object is not worth failing the
      // deletion the person asked for.
    }
  }

  try {
    const admin = createAdminSupabase()
    const { error } = await admin.auth.admin.deleteUser(user.id)

    const supabase = await createServerSupabase()
    await supabase.auth.signOut()

    if (error) {
      return err(
        appError(
          'INTERNAL',
          'Your account data is deleted, but we could not release your sign-in. Contact support before signing up again with this address.',
        ),
      )
    }

    return ok(undefined)
  } catch {
    return err(
      appError(
        'INTERNAL',
        'Your account data is deleted, but we could not release your sign-in. Contact support before signing up again with this address.',
      ),
    )
  }
}
