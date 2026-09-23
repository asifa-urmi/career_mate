import type { Metadata } from 'next'
import Link from 'next/link'
import type { Role } from '@prisma/client'
import { requireGroup } from '@/lib/auth/require-group'
import { PageHead } from '@/components/layout'
import { Button, Card, EmptyState, MetricCard } from '@/components/ui'
import { UserRow } from '@/components/admin/user-row'
import { adminCounts, listUsersForAdmin } from '@/lib/db/repositories/employer.repository'
import { cn } from '@/lib/utils/cn'

export const metadata: Metadata = { title: 'Users — CareerMate' }
export const dynamic = 'force-dynamic'

const FILTERS = [
  { value: 'ALL', label: 'Everyone' },
  { value: 'CANDIDATE', label: 'Job seekers' },
  { value: 'EMPLOYER', label: 'Employers' },
  { value: 'ADMIN', label: 'Administrators' },
  { value: 'SUSPENDED', label: 'Suspended' },
] as const

const ROLES = new Set<string>(['CANDIDATE', 'EMPLOYER', 'ADMIN'])

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string | string[]; q?: string | string[] }>
}) {
  const admin = await requireGroup('admin')

  const params = await searchParams
  // A repeated query key arrives as an array; handing that to Prisma for an
  // enum or a string column is a 500 on an authenticated page.
  const raw = Array.isArray(params.filter) ? params.filter[0] : params.filter
  const search = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim() || undefined

  const filter = {
    ...(raw && ROLES.has(raw) ? { role: raw as Role } : {}),
    ...(raw === 'SUSPENDED' ? { suspended: true } : {}),
    ...(search ? { search } : {}),
  }

  const [users, counts] = await Promise.all([listUsersForAdmin(filter), adminCounts()])

  return (
    <>
      <PageHead
        title="Users"
        description="Accounts across the platform. Everything here is reversible — nothing deletes a person's data."
        actions={
          <Button href="/admin" variant="ghost">
            Back to overview
          </Button>
        }
      />

      <div className="mb-4.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Job seekers" value={counts.candidates} />
        <MetricCard label="Employers" value={counts.employers} />
        <MetricCard label="Administrators" value={counts.admins} />
        <MetricCard label="Suspended" value={counts.suspended} />
      </div>

      <form className="mb-4 flex flex-wrap gap-2.5" role="search">
        <label htmlFor="q" className="sr-only">
          Search by name or email
        </label>
        <input
          id="q"
          name="q"
          defaultValue={search ?? ''}
          placeholder="Search by name or email"
          className="min-w-60 flex-1 rounded-[var(--radius-field)] border border-line bg-surface px-3.5 py-3 text-sm outline-none focus:border-blue"
        />
        {raw && <input type="hidden" name="filter" value={raw} />}
        <Button type="submit">Search</Button>
      </form>

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = f.value === 'ALL' ? !raw : raw === f.value
          return (
            <Link
              key={f.value}
              href={f.value === 'ALL' ? '/admin/users' : `/admin/users?filter=${f.value}`}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'rounded-[10px] border px-3 py-2 text-xs font-bold transition-colors',
                active
                  ? 'border-[#c9d8ff] bg-blue-wash text-blue'
                  : 'border-line bg-surface text-[#58617a] hover:border-[#cbd8ff]',
              )}
            >
              {f.label}
            </Link>
          )
        })}
      </div>

      {users.length === 0 ? (
        <Card>
          <EmptyState
            glyph="◉"
            title="Nobody matches"
            body="Try a different filter or search."
            action={
              <Button href="/admin/users" variant="ghost">
                Clear filters
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="grid list-none gap-3 p-0">
          {users.map((user) => (
            <li key={user.id}>
              <UserRow user={user} isSelf={user.id === admin.id} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
