'use client'

import { useState } from 'react'
import type { Role } from '@prisma/client'
import { Button } from '@/components/ui'
import { SEARCH_PLACEHOLDER, searchActionFor } from '@/config/nav'
import { Sidebar } from './sidebar'

/**
 * The signed-in frame: fixed 248px rail, 72px sticky blurred topbar, content
 * column. Below `lg` the rail slides in over the content and a backdrop closes
 * it — the prototype had a hamburger that toggled a class and no way to dismiss
 * the menu once open.
 */
export function AppShell({
  role,
  userName,
  userSubtitle,
  primaryAction,
  unreadCount = 0,
  children,
}: {
  role: Role
  userName: string
  userSubtitle: string
  primaryAction?: { href: string; label: string }
  unreadCount?: number
  children: React.ReactNode
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-bg lg:grid lg:grid-cols-[248px_1fr]">
      <Sidebar
        role={role}
        userName={userName}
        userSubtitle={userSubtitle}
        open={menuOpen}
        onNavigate={() => setMenuOpen(false)}
      />

      {menuOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-50 bg-navy/40 lg:hidden"
        />
      )}

      <div className="min-w-0 lg:col-start-2">
        <header className="sticky top-0 z-45 flex h-[72px] items-center justify-between gap-4 border-b border-line/85 bg-bg/85 px-4 backdrop-blur-xl lg:px-7">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="app-sidebar"
            className="rounded-[var(--radius-field)] border border-line bg-surface px-3 py-2 lg:hidden"
          >
            ☰
          </button>

          <form action={searchActionFor(role)} className="relative hidden flex-1 sm:block sm:max-w-[460px]">
            <label htmlFor="global-search" className="sr-only">
              Search
            </label>
            <span
              className="pointer-events-none absolute top-2 left-3.5 text-[22px] text-[#7d879f]"
              aria-hidden="true"
            >
              ⌕
            </span>
            <input
              id="global-search"
              name="q"
              placeholder={SEARCH_PLACEHOLDER[role]}
              className="w-full rounded-[var(--radius-field)] border border-line bg-surface py-3 pr-3.5 pl-10 text-sm outline-none focus:border-blue"
            />
          </form>

          <div className="flex items-center gap-2.5">
            <Button
              href="/notifications"
              variant="ghost"
              size="sm"
              className="relative"
              aria-label={
                unreadCount > 0
                  ? `Notifications, ${unreadCount} unread`
                  : 'Notifications'
              }
            >
              ◌
              {unreadCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 grid min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[10px] font-extrabold text-white"
                  aria-hidden="true"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
            {primaryAction && (
              <Button href={primaryAction.href} size="sm" className="hidden sm:inline-flex">
                {primaryAction.label}
              </Button>
            )}
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] px-4 pt-6.5 pb-12 lg:px-7">{children}</main>
      </div>
    </div>
  )
}
