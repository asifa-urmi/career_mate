import type { Metadata } from 'next'
import { requireGroup } from '@/lib/auth/require-group'
import { PageHead } from '@/components/layout'
import { Badge, Button, Card, CardTitle } from '@/components/ui'
import {
  DangerPanel,
  DataPanel,
  EmailPanel,
  NotificationsPanel,
  PasswordPanel,
} from '@/components/settings/settings-panels'
import { homePathFor } from '@/lib/auth/roles'
import { prisma } from '@/lib/db/prisma'

export const metadata: Metadata = { title: 'Settings — CareerMate' }
export const dynamic = 'force-dynamic'

const ROLE_LABEL = {
  CANDIDATE: 'Job seeker',
  EMPLOYER: 'Employer',
  ADMIN: 'Platform administrator',
} as const

export default async function SettingsPage() {
  const user = await requireGroup('shared')

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { notifyOn: true, createdAt: true },
  })

  return (
    <>
      <PageHead
        title="Settings"
        description="Your account, what you hear about, and your data."
        actions={
          <Button href={homePathFor(user.role)} variant="ghost">
            Back to workspace
          </Button>
        }
      />

      <div className="grid gap-4.5 lg:grid-cols-[1fr_300px]">
        <div className="grid gap-4.5">
          <EmailPanel email={user.email} />
          <PasswordPanel />
          <NotificationsPanel enabled={account?.notifyOn ?? []} />
          <DataPanel />
          <DangerPanel />
        </div>

        <div className="grid content-start gap-4.5">
          <Card padded>
            <CardTitle>Account</CardTitle>
            <dl className="m-0 grid gap-2.5 text-[13px]">
              <div className="flex justify-between gap-3 border-b border-line pb-2.5">
                <dt className="text-muted">Type</dt>
                <dd className="m-0">
                  <Badge tone="dark">{ROLE_LABEL[user.role]}</Badge>
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-line pb-2.5">
                <dt className="text-muted">Name</dt>
                <dd className="m-0 font-semibold">{user.name}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Joined</dt>
                <dd className="m-0 font-semibold">
                  {account?.createdAt.toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  }) ?? '—'}
                </dd>
              </div>
            </dl>

            <p className="m-0 mt-4 text-xs leading-relaxed text-muted">
              Your account type is set by a platform administrator, not from here — otherwise
              anyone could make themselves an employer, or an admin.
            </p>
          </Card>

          <Card padded>
            <CardTitle>Privacy</CardTitle>
            <p className="m-0 text-xs leading-relaxed text-muted">
              Your CV is private. An employer can only open it once you have applied to one of
              their roles, and the link they get expires within minutes. Your profile is shown to
              an employer only alongside an application you sent them.
            </p>
          </Card>
        </div>
      </div>
    </>
  )
}
