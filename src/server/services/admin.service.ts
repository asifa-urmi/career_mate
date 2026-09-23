import 'server-only'

import type { Role } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { appError } from '@/lib/utils/errors'
import { err, ok, type Result } from '@/lib/utils/result'
import type { SessionUser } from '@/lib/auth/session'

/**
 * Admin actions on other accounts.
 *
 * Two rules the platform cannot operate without:
 *
 *  - **An admin cannot act on themselves.** Demoting or suspending your own
 *    account is not reversible by you afterwards, and there is no reason to do
 *    it that a second admin could not do instead.
 *  - **The last admin cannot be removed.** A platform with no administrator has
 *    no moderation, no way to promote a new one, and no route back except
 *    editing the database by hand.
 *
 * Everything here is reversible. Nothing deletes a person's data — an account
 * that can only be deleted is an account that gets deleted by mistake.
 */

type Target = { id: string; name: string; role: Role; suspendedAt: Date | null }

function requireAdmin(user: SessionUser): Result<void> {
  if (user.role !== 'ADMIN') {
    return err(appError('FORBIDDEN', 'Only a platform administrator can do that.'))
  }
  return ok(undefined)
}

export async function changeUserRole(
  admin: SessionUser,
  userId: string,
  role: Role,
): Promise<Result<void>> {
  const allowed = requireAdmin(admin)
  if (!allowed.ok) return allowed

  if (userId === admin.id) {
    return err(
      appError('CONFLICT', 'You cannot change your own role. Ask another administrator.'),
    )
  }

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const target = (await tx.user.findFirst({
        where: { id: userId },
        select: { id: true, name: true, role: true, suspendedAt: true },
      })) as Target | null

      if (!target) return { kind: 'not-found' as const }
      if (target.role === role) return { kind: 'unchanged' as const }

      if (target.role === 'ADMIN') {
        const admins = await tx.user.count({ where: { role: 'ADMIN' } })
        if (admins <= 1) return { kind: 'last-admin' as const }
      }

      await tx.user.update({ where: { id: target.id }, data: { role } })

      await tx.notification.create({
        data: {
          userId: target.id,
          type: 'SYSTEM',
          title: 'Your account type changed',
          body: `A platform administrator changed your account to ${label(role)}. Sign out and back in to see your new workspace.`,
          href: '/settings',
        },
      })

      return { kind: 'ok' as const }
    })

    switch (outcome.kind) {
      case 'not-found':
        return err(appError('NOT_FOUND', 'We could not find that account.'))
      case 'last-admin':
        return err(
          appError(
            'CONFLICT',
            'That is the last administrator. Promote someone else before changing this account.',
          ),
        )
      case 'unchanged':
      case 'ok':
        return ok(undefined)
    }
  } catch {
    return err(appError('INTERNAL', 'We could not change that account. Please try again.'))
  }
}

export async function setUserSuspended(
  admin: SessionUser,
  userId: string,
  suspended: boolean,
  reason?: string,
): Promise<Result<void>> {
  const allowed = requireAdmin(admin)
  if (!allowed.ok) return allowed

  if (userId === admin.id) {
    return err(appError('CONFLICT', 'You cannot suspend your own account.'))
  }

  const trimmed = reason?.trim().slice(0, 500)

  // A suspension with no stated reason leaves the person locked out with
  // nothing to appeal against.
  if (suspended && !trimmed) {
    return err(appError('VALIDATION', 'Give a reason — the person is told what it was.'))
  }

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const target = (await tx.user.findFirst({
        where: { id: userId },
        select: { id: true, name: true, role: true, suspendedAt: true },
      })) as Target | null

      if (!target) return { kind: 'not-found' as const }
      if (Boolean(target.suspendedAt) === suspended) return { kind: 'unchanged' as const }

      if (suspended && target.role === 'ADMIN') {
        const admins = await tx.user.count({ where: { role: 'ADMIN' } })
        if (admins <= 1) return { kind: 'last-admin' as const }
      }

      await tx.user.update({
        where: { id: target.id },
        data: suspended
          ? { suspendedAt: new Date(), suspendedReason: trimmed ?? null }
          : { suspendedAt: null, suspendedReason: null },
      })

      await tx.notification.create({
        data: {
          userId: target.id,
          type: 'SYSTEM',
          title: suspended ? 'Your account is suspended' : 'Your account is active again',
          body: suspended
            ? `A platform administrator suspended your account. Reason: ${trimmed}. Contact support if you think this is wrong.`
            : 'A platform administrator lifted the suspension on your account.',
          href: '/settings',
        },
      })

      return { kind: 'ok' as const }
    })

    switch (outcome.kind) {
      case 'not-found':
        return err(appError('NOT_FOUND', 'We could not find that account.'))
      case 'last-admin':
        return err(
          appError('CONFLICT', 'That is the last administrator and cannot be suspended.'),
        )
      case 'unchanged':
      case 'ok':
        return ok(undefined)
    }
  } catch {
    return err(appError('INTERNAL', 'We could not update that account. Please try again.'))
  }
}

function label(role: Role): string {
  if (role === 'CANDIDATE') return 'a job seeker account'
  if (role === 'EMPLOYER') return 'an employer account'
  return 'a platform administrator'
}
