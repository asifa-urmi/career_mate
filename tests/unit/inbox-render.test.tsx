import { describe, expect, it, vi } from 'vitest'

// The shell's nav highlights the current route, which it reads from the router.
// Without a router context `usePathname` returns null, which is a fact about
// this harness and not about production — so it is given a real path here,
// otherwise the test would be asserting against its own missing setup.
vi.mock('next/navigation', () => ({
  usePathname: () => '/messages',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}))
import { renderToStaticMarkup } from 'react-dom/server'
import { ToastProvider } from '@/components/ui/toast'
import { Inbox } from '@/components/messages/inbox'
import { AppShell } from '@/components/layout/app-shell'
import type { ConversationDetail, ConversationSummary } from '@/lib/db/repositories/message.repository'

/**
 * The inbox renders, including with nothing in it.
 *
 * `/messages` was returning the error page in production while every query it
 * makes ran clean against the same database — so whatever was wrong was in the
 * rendering, which no query-level test could see. This renders the component the
 * page hands its data to, in the two states that page can produce.
 */
function render(node: React.ReactNode): string {
  return renderToStaticMarkup(<ToastProvider>{node}</ToastProvider>)
}

const summary: ConversationSummary = {
  id: 'c-1',
  subject: 'Accounts Officer at Meridian',
  otherName: 'Meridian Group',
  lastMessage: 'Can you come in on Thursday?',
  lastAtLabel: '2 days ago',
  unread: true,
}

const detail: ConversationDetail = {
  ...summary,
  applicationId: 'app-1',
  jobId: 'job-1',
  messages: [
    { id: 'm-1', body: 'Hello', mine: false, atLabel: '2 days ago' },
    { id: 'm-2', body: 'Thank you', mine: true, atLabel: '1 day ago' },
  ],
}

describe('the inbox renders', () => {
  // What a brand-new account sees, and what the failing page was most likely
  // rendering: nobody has written to them yet.
  it('with no conversations at all', () => {
    const html = render(
      <Inbox
        conversations={[]}
        initial={null}
        emptyBody="When an employer gets in touch, the conversation appears here."
        jobHrefFor={(id) => `/jobs/${id}`}
      />,
    )

    expect(html).toContain('No conversations yet')
  })

  it('with a thread open', () => {
    const html = render(
      <Inbox
        conversations={[summary]}
        initial={detail}
        emptyBody="…"
        jobHrefFor={(id) => `/jobs/${id}`}
      />,
    )

    expect(html).toContain('Meridian Group')
    expect(html).toContain('Thank you')
  })

  it('with a thread that has no job attached', () => {
    const html = render(
      <Inbox
        conversations={[summary]}
        initial={{ ...detail, jobId: null }}
        emptyBody="…"
        jobHrefFor={(id) => `/jobs/${id}`}
      />,
    )

    expect(html).not.toContain('View role')
  })

  it('with a conversation list but nothing selected', () => {
    const html = render(
      <Inbox
        conversations={[summary]}
        initial={null}
        emptyBody="…"
        jobHrefFor={(id) => `/jobs/${id}`}
      />,
    )

    expect(html).toContain('Choose a conversation')
  })
})

/**
 * The signed-in frame renders for every role.
 *
 * Every protected page goes through this, so a throw here takes the whole
 * workspace down and shows the error card with no sidebar — which is exactly
 * what `/messages`, `/profile` and `/dashboard` were showing while every query
 * they make ran clean.
 */
describe('the app shell renders', () => {
  for (const role of ['CANDIDATE', 'EMPLOYER', 'ADMIN'] as const) {
    it(`for ${role}`, () => {
      const html = render(
        <AppShell
          role={role}
          userName="MD. TANVIR RAHMAN"
          userAvatarUrl={null}
          userSubtitle="Technology"
          unreadCount={3}
          primaryAction={{ href: '/jobs', label: 'Find jobs' }}
        >
          <p>page body</p>
        </AppShell>,
      )

      expect(html).toContain('page body')
      expect(html).toContain('CareerMate')
    })
  }

  it('with a stored photo rather than initials', () => {
    const html = render(
      <AppShell
        role="CANDIDATE"
        userName="MD. TANVIR RAHMAN"
        userAvatarUrl="https://phkcevxkagmuqbsiqxqm.supabase.co/storage/v1/object/public/avatars/u/a.png"
        userSubtitle="Technology"
      >
        <p>page body</p>
      </AppShell>,
    )

    expect(html).toContain('page body')
  })

  it('with no subtitle and no primary action', () => {
    const html = render(
      <AppShell role="CANDIDATE" userName="A" userSubtitle="">
        <p>page body</p>
      </AppShell>,
    )

    expect(html).toContain('page body')
  })
})
