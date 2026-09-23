'use client'

import { useState, useTransition } from 'react'
import type { Role } from '@prisma/client'
import { Avatar, Badge, Button, Card, Input, Select, useToast } from '@/components/ui'
import type { AdminUserRow } from '@/lib/db/repositories/employer.repository'
import { changeRoleAction, setSuspendedAction } from '@/app/(admin)/admin/users/actions'

const ROLES = [
  { value: 'CANDIDATE', label: 'Job seeker' },
  { value: 'EMPLOYER', label: 'Employer' },
  { value: 'ADMIN', label: 'Administrator' },
]

const ROLE_TONE: Record<Role, 'blue' | 'dark' | 'mint'> = {
  CANDIDATE: 'blue',
  EMPLOYER: 'dark',
  ADMIN: 'mint',
}

export function UserRow({ user, isSelf }: { user: AdminUserRow; isSelf: boolean }) {
  const [role, setRole] = useState<Role>(user.role)
  const [reason, setReason] = useState('')
  const [pending, start] = useTransition()
  const { show } = useToast()

  function run(fn: () => Promise<{ error?: string }>, success: string) {
    start(async () => {
      const result = await fn()
      if (result.error) {
        setRole(user.role)
        show(result.error, 'error')
        return
      }
      show(success, 'success')
    })
  }

  return (
    <Card className="p-4.5">
      <div className="flex flex-wrap items-start gap-3.5">
        <Avatar name={user.name} size={44} />

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <b className="text-sm">{user.name}</b>
            <Badge tone={ROLE_TONE[user.role]}>
              {ROLES.find((r) => r.value === user.role)?.label ?? user.role}
            </Badge>
            {user.suspended && <Badge tone="danger">Suspended</Badge>}
            {isSelf && <Badge tone="warn">You</Badge>}
          </div>
          <span className="block text-xs text-muted">{user.email}</span>
          <span className="mt-1 block text-[11px] text-muted">
            Joined {user.joinedLabel}
            {user.applications > 0 && ` · ${user.applications} applications`}
            {user.postedJobs > 0 && ` · ${user.postedJobs} jobs posted`}
          </span>
          {user.suspended && user.suspendedReason && (
            <p className="m-0 mt-2 text-xs leading-relaxed text-[#b83c51]">
              Reason: {user.suspendedReason}
            </p>
          )}
        </div>
      </div>

      {isSelf ? (
        <p className="m-0 mt-3.5 border-t border-line pt-3 text-xs leading-relaxed text-muted">
          You cannot change or suspend your own account. Another administrator has to do it —
          otherwise a mistake would be yours alone to undo, and you would not be able to.
        </p>
      ) : (
        <div className="mt-3.5 grid gap-2.5 border-t border-line pt-3 sm:grid-cols-[180px_1fr_auto]">
          <Select
            options={ROLES}
            value={role}
            disabled={pending}
            aria-label={`Role for ${user.name}`}
            onChange={(e) => {
              const next = e.target.value as Role
              setRole(next)
              run(() => changeRoleAction(user.id, next), `${user.name} is now ${next.toLowerCase()}`)
            }}
          />

          {user.suspended ? (
            <>
              <span />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                loading={pending}
                onClick={() =>
                  run(() => setSuspendedAction(user.id, false), 'Suspension lifted')
                }
              >
                Lift suspension
              </Button>
            </>
          ) : (
            <>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason — required, and shown to them"
                disabled={pending}
              />
              <Button
                type="button"
                size="sm"
                variant="danger"
                loading={pending}
                onClick={() =>
                  run(
                    () => setSuspendedAction(user.id, true, reason),
                    `${user.name} suspended`,
                  )
                }
              >
                Suspend
              </Button>
            </>
          )}
        </div>
      )}
    </Card>
  )
}
