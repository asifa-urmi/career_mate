import Link from 'next/link'
import { Brand } from './brand'

const COLUMNS = [
  {
    heading: 'Candidates',
    links: [
      { href: '/jobs-public', label: 'Browse jobs' },
      { href: '/signup', label: 'Create a profile' },
      { href: '/login', label: 'Sign in' },
    ],
  },
  {
    heading: 'Employers',
    links: [
      { href: '/signup', label: 'Post a job' },
      { href: '/login', label: 'Employer sign in' },
    ],
  },
  {
    heading: 'Platform',
    links: [{ href: '/jobs-public', label: 'All sectors' }],
  },
] as const

/**
 * Only real destinations. The prototype's footer was a grid of dead `<a>` tags
 * with no href, which looked complete and led nowhere.
 */
export function Footer() {
  return (
    <footer className="bg-[#071127] py-14 text-[#c2cae0]">
      <div className="mx-auto w-[min(1180px,calc(100%-32px))]">
        <div className="grid gap-7 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Brand onDark />
            <p className="mt-3 max-w-[330px] text-[13px] leading-relaxed">
              A multi-sector career platform: job discovery, CV intelligence, application
              tracking and AI guidance for candidates, employers and platform staff.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h4 className="mb-1 font-display text-sm text-white">{col.heading}</h4>
              {col.links.map((link) => (
                <Link
                  key={`${col.heading}-${link.label}`}
                  href={link.href}
                  className="my-2.5 block text-[13px] hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-xs text-[#8b97b5]">
          © {new Date().getFullYear()} CareerMate
        </div>
      </div>
    </footer>
  )
}
