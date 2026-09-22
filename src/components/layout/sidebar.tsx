'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Role } from '@prisma/client'
import { cn } from '@/lib/utils/cn'
import { navFor, WORKSPACE_LABEL } from '@/config/nav'
import { Avatar } from '@/components/ui'
import { signOutAction } from '@/app/(auth)/actions'
import { Brand } from './brand'
import { textGlyph } from '@/lib/utils/glyph'
import { isNavItemActive } from './nav-active'

/**
 * The 248px navy rail. Fixed, full height, with a mint inset bar marking the
 * active link — the prototype's signature.
 *
 * A client component because it needs the current path to mark the active item.
 * It takes the user as props rather than loading them, so it stays renderable in
 * isolation.
 */
export function Sidebar({
  role,
  userName,
  userSubtitle,
  open,
  onNavigate,
}: {
  role: Role
  userName: string
  userSubtitle: string
  open: boolean
  onNavigate: () => void
}) {
  const pathname = usePathname()
  const sections = navFor(role)
  const allHrefs = sections.flatMap((s) => s.items.map((i) => i.href))

  const home = role === 'EMPLOYER' ? '/employer' : role === 'ADMIN' ? '/admin' : '/dashboard'

  return (
    <aside
      id="app-sidebar"
      className={cn(
        'fixed inset-y-0 left-0 z-60 flex w-[248px] flex-col px-3.5 py-4.5 text-[#c4cde4]',
        'transition-transform duration-200 lg:translate-x-0',
        role === 'EMPLOYER' ? 'employer-accent' : 'bg-navy',
        open ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      <div className="px-2.5 pt-2 pb-5">
        <Brand href={home} onDark />
      </div>

      <nav aria-label={WORKSPACE_LABEL[role]} className="flex-1 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.section}>
            <p className="mt-4.5 mb-2 px-3 text-[10px] font-extrabold tracking-[0.12em] text-[#6f7d9e] uppercase">
              {section.section}
            </p>
            <ul className="grid list-none gap-1.5 p-0">
              {section.items.map((item) => {
                const active = isNavItemActive(item.href, pathname, allHrefs)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm font-semibold',
                        'transition-colors hover:bg-white/10 hover:text-white',
                        active ? 'side-link-active bg-white/10 text-white' : 'text-[#aeb9d2]',
                      )}
                    >
                      <span className="w-6 text-center" aria-hidden="true">
                        {textGlyph(item.glyph)}
                      </span>
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-auto border-t border-white/10 pt-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={userName} size={38} />
          <div className="min-w-0 flex-1">
            <b className="block truncate text-[13px] text-white">{userName}</b>
            <small className="block truncate text-[11px] text-[#8b97b5]">{userSubtitle}</small>
          </div>
        </div>
        <form action={signOutAction} className="mt-2.5">
          <button
            type="submit"
            className="w-full rounded-[10px] border border-white/12 px-3 py-2 text-[13px] font-semibold text-[#aeb9d2] transition-colors hover:bg-white/10 hover:text-white"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  )
}
