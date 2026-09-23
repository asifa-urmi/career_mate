import { Button } from '@/components/ui'
import { homePathFor } from '@/lib/auth/roles'
import type { SessionUser } from '@/lib/auth/session'
import { Brand } from './brand'

/**
 * `decideRoute` deliberately lets signed-in people stay on marketing pages, so
 * "signed in, looking at the landing page" is a normal state rather than an
 * edge case. Showing them Sign in and Create account there left no visible way
 * back to their own workspace.
 */
export function PublicNav({
  showSectionLinks = false,
  user = null,
}: {
  showSectionLinks?: boolean
  user?: SessionUser | null
}) {
  return (
    <nav className="sticky top-0 z-50 border-b border-line/70 bg-surface/85 backdrop-blur-xl">
      <div className="mx-auto flex w-[min(1180px,calc(100%-32px))] items-center justify-between gap-6 py-3.5">
        <Brand />

        {showSectionLinks && (
          <div className="hidden items-center gap-7 text-sm font-semibold text-muted md:flex">
            <a href="#sectors" className="hover:text-navy">
              Job sectors
            </a>
            <a href="#features" className="hover:text-navy">
              Candidate tools
            </a>
            <a href="#ai" className="hover:text-navy">
              AI
            </a>
            <a href="#employers" className="hover:text-navy">
              Employers
            </a>
          </div>
        )}

        <div className="flex items-center gap-2.5">
          {user ? (
            <>
              <span className="hidden text-[13px] font-semibold text-muted sm:inline">
                {user.name}
              </span>
              <Button href={homePathFor(user.role)} size="sm">
                Go to workspace
              </Button>
            </>
          ) : (
            <>
              <Button href="/login" variant="ghost" size="sm">
                Sign in
              </Button>
              <Button href="/signup" size="sm">
                Create account
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
