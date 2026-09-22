# CareerMate P0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A stranger can open the deployed URL, create a real account, pick a role, complete onboarding, and land in a real (if empty) dashboard — with the prototype's visual design intact.

**Architecture:** Next.js 15 App Router with route groups per role. Supabase Auth issues cookie sessions read by middleware and server components; Prisma owns the Postgres schema. One-way layer flow: components (props only) → pages (guard + call service) → services (rules + authorization) → repositories (Prisma only). The full database schema for all four phases lands in P0 so later phases add features, not migrations that reshape existing tables.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Tailwind CSS v4, Prisma 6, Supabase (Auth + Postgres + Storage), Zod 4, Vitest 3.

**Spec:** [`docs/superpowers/specs/2026-09-23-careermate-rebuild-design.md`](../specs/2026-09-23-careermate-rebuild-design.md)

## Global Constraints

- Next.js **15** App Router only — no `pages/` directory, no `getServerSideProps`.
- Design tokens are copied verbatim from `legacy/styles.css` and are the single source of truth: navy `#0a1533`, navy-2 `#101f47`, blue `#2f6bff`, blue-2 `#5d8bff`, mint `#3ed6b2`, mint-soft `#dffaf3`, bg `#f5f7fb`, surface `#ffffff`, text `#111a33`, muted `#69738c`, line `#e5e9f2`, danger `#ff5f72`, warning `#f9b94f`, radius `18px`, radius-sm `12px`, shadow `0 14px 45px rgba(17,36,84,.10)`, shadow-sm `0 6px 18px rgba(17,36,84,.08)`.
- Fonts: Inter (body, weights 400/500/600/700/800), Manrope (headings, 600/700/800), loaded via `next/font/google`.
- Sidebar is exactly `248px`; topbar is exactly `72px`. Content grid is 12 columns, `18px` gap.
- **No component in `src/components/` may import Prisma, a Supabase client, or a service.** Components take props and callbacks only.
- **Only files under `src/lib/db/repositories/` may import `prisma`.**
- **Only services under `src/server/services/` may make authorization decisions.**
- Every server-side input is validated with a Zod schema from `src/lib/validation/` before it reaches a service.
- Currency is Bangladeshi taka rendered as `৳`; locations and seed content stay Bangladesh-facing as in the prototype.
- Secrets live only in `.env.local` (gitignored) and are documented in `.env.example`. Never commit a key.

## Review Focus

Five conditions the spec implies that no feature task naturally exercises. Each line's test is added to the task that owns the code.

1. **Supabase session exists but no `User` row** (signup interrupted between auth creation and profile insert) — every protected page would crash on `user.role`. Expected: treated as unauthenticated, redirected to `/signup` to finish. → Task 5.
2. **Signup with an already-registered email** — Supabase returns an error the UI must render as a message. Expected: inline "email already registered", no 500, form values preserved. → Task 10.
3. **Candidate opens an employer-only URL directly** (and employer opens `/dashboard`, and either opens `/admin`) — Expected: redirect to their own home, never a rendered employer page or a raw 403. → Task 5.
4. **Onboarding submitted with a sector not in the category list**, or an empty required field, by a hand-crafted POST — Expected: server rejects via Zod and returns field errors; nothing is written. → Task 11.
5. **Session cookie expires mid-form-submit** — a server action runs with no valid session. Expected: redirect to `/login`, not an unhandled exception. → Task 9.

---

## File Structure

| Path | Responsibility |
|---|---|
| `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts` | Tooling |
| `src/app/globals.css` | Design tokens (`@theme`) + signature component CSS |
| `src/app/layout.tsx` | Root layout, fonts, `<Toaster>` mount |
| `src/config/categories.ts` | The 11 job categories: enum value, label, glyph |
| `src/config/nav.ts` | Sidebar nav items per role |
| `src/config/constants.ts` | Experience levels, work modes, job types, stage labels, upload limits |
| `prisma/schema.prisma` | Full schema, all four phases |
| `prisma/seed.ts` | 12 jobs, 1 company, demo accounts |
| `src/lib/db/prisma.ts` | Prisma singleton (hot-reload safe) |
| `src/lib/db/repositories/user.repository.ts` | User + profile reads/writes |
| `src/lib/supabase/server.ts` | Cookie-backed server client |
| `src/lib/supabase/client.ts` | Browser client |
| `src/lib/supabase/middleware.ts` | Session refresh for middleware |
| `src/lib/utils/result.ts` | `Result<T>` — `ok()` / `err()` / `isOk()` |
| `src/lib/utils/errors.ts` | `AppError` codes and constructors |
| `src/lib/utils/cn.ts` | Class name joiner |
| `src/lib/utils/format.ts` | `formatTaka`, `relativeTime`, `initials` |
| `src/lib/auth/roles.ts` | Role constants, home path per role, route-group access |
| `src/lib/auth/session.ts` | `getCurrentUser()` — Supabase session → `User` row |
| `src/lib/auth/guards.ts` | `requireUser`, `requireRole`, `requireOnboarded` |
| `src/lib/validation/auth.schema.ts` | Signup, login schemas |
| `src/lib/validation/onboarding.schema.ts` | Onboarding steps, company setup schemas |
| `src/middleware.ts` | Session refresh + route-group protection |
| `src/server/services/auth.service.ts` | Signup, login, role assignment, onboarding completion |
| `src/components/ui/*` | 15 presentational primitives |
| `src/components/layout/*` | `AppShell`, `Sidebar`, `Topbar`, `PublicNav`, `Footer`, `PageHead` |
| `src/app/(marketing)/*` | Landing, public job browse |
| `src/app/(auth)/*` | Login, signup, onboarding, company setup |
| `src/app/(candidate)/dashboard/page.tsx` | Candidate home |
| `src/app/(employer)/employer/page.tsx` | Employer home |
| `src/app/(admin)/admin/page.tsx` | Admin home |
| `tests/unit/*`, `tests/integration/*` | Vitest suites |
| `.env.example`, `README.md` | Setup + deploy documentation |

---

## Task 1: Scaffold, tooling and design tokens

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `next-env.d.ts`
- Create: `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx` (temporary)
- Create: `src/lib/utils/cn.ts`
- Test: `tests/unit/cn.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `cn(...classes: (string | false | null | undefined)[]): string`; npm scripts `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:watch`; Tailwind theme variables named `--color-navy`, `--color-navy-2`, `--color-blue`, `--color-blue-2`, `--color-mint`, `--color-mint-soft`, `--color-bg`, `--color-surface`, `--color-text`, `--color-muted`, `--color-line`, `--color-danger`, `--color-warning` (so `bg-navy`, `text-mint`, `border-line` work as utilities), plus `--radius-card: 18px`, `--radius-field: 12px`, `--shadow-card`, `--shadow-card-sm`, `--font-sans`, `--font-display`.

- [ ] **Step 1: Write the failing test for `cn`**

```ts
// tests/unit/cn.test.ts
import { describe, expect, it } from 'vitest'
import { cn } from '@/lib/utils/cn'

describe('cn', () => {
  it('joins truthy class names with a single space', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c')
  })

  it('drops false, null, undefined and empty strings', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b')
  })

  it('returns an empty string when nothing is truthy', () => {
    expect(cn(false, null, undefined)).toBe('')
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- cn`
Expected: FAIL — cannot resolve `@/lib/utils/cn`.

- [ ] **Step 3: Write `cn`**

```ts
// src/lib/utils/cn.ts
type ClassValue = string | false | null | undefined

export function cn(...classes: ClassValue[]): string {
  return classes.filter((c): c is string => Boolean(c)).join(' ')
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `npm test -- cn`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write `globals.css` with the tokens**

Tailwind v4 `@theme` block. Copy the hex values from Global Constraints exactly. Then add the signature component classes ported from `legacy/styles.css` — `.score-ring` (conic-gradient), `.ai-banner` (navy gradient + ghost `✦` via `::after`), `.profile-cover` (3-stop gradient), `.upload-box` (dashed border), `.bar-chart .bar` (grow keyframes), `.switch`, `.stepper` pieces, `.status` chips. These are the elements the spec names as the design's identity; they use gradients and pseudo-elements that are clearer as CSS than as utility soup.

- [ ] **Step 6: Write the root layout with fonts**

`next/font/google` for Inter (`--font-sans`) and Manrope (`--font-display`), both `display: 'swap'`, attached to `<html>` as CSS variables. Metadata title `CareerMate — AI Career Network`, description from `legacy/index.html`.

- [ ] **Step 7: Verify the toolchain end to end**

Run: `npm run typecheck && npm run build`
Expected: both succeed, zero errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 15 app with the prototype's design tokens"
```

---

## Task 2: Result type and error taxonomy

**Files:**
- Create: `src/lib/utils/result.ts`, `src/lib/utils/errors.ts`
- Test: `tests/unit/result.test.ts`, `tests/unit/errors.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Result<T> = { ok: true; value: T } | { ok: false; error: AppError }`
  - `ok<T>(value: T): Result<T>`
  - `err<T = never>(error: AppError): Result<T>`
  - `type AppErrorCode = 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION' | 'CONFLICT' | 'RATE_LIMITED' | 'QUOTA_EXHAUSTED' | 'UPLOAD_TOO_LARGE' | 'UNSUPPORTED_FILE_TYPE' | 'PROVIDER_UNAVAILABLE' | 'INTERNAL'`
  - `interface AppError { code: AppErrorCode; message: string; fieldErrors?: Record<string, string[]> }`
  - `appError(code, message, fieldErrors?): AppError`
  - `validationError(fieldErrors: Record<string, string[]>): AppError` — code `VALIDATION`, message `'Please correct the highlighted fields.'`
  - `httpStatusFor(code: AppErrorCode): number` — 401/403/404/422/409/429/429/413/415/503/500 respectively

Every later task's service returns `Result`, so these names are load-bearing.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/result.test.ts
import { describe, expect, it } from 'vitest'
import { ok, err } from '@/lib/utils/result'
import { appError } from '@/lib/utils/errors'

describe('Result', () => {
  it('ok carries the value and narrows', () => {
    const r = ok(42)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBe(42)
  })

  it('err carries the error and narrows', () => {
    const e = appError('NOT_FOUND', 'Job not found')
    const r = err(e)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('NOT_FOUND')
  })

  it('ok(undefined) is still a success', () => {
    expect(ok(undefined).ok).toBe(true)
  })
})
```

```ts
// tests/unit/errors.test.ts
import { describe, expect, it } from 'vitest'
import { appError, validationError, httpStatusFor } from '@/lib/utils/errors'

describe('errors', () => {
  it('validationError collects field errors under the VALIDATION code', () => {
    const e = validationError({ email: ['Enter a valid email address'] })
    expect(e.code).toBe('VALIDATION')
    expect(e.fieldErrors?.email).toEqual(['Enter a valid email address'])
  })

  it('maps every code to an HTTP status', () => {
    expect(httpStatusFor('UNAUTHENTICATED')).toBe(401)
    expect(httpStatusFor('FORBIDDEN')).toBe(403)
    expect(httpStatusFor('NOT_FOUND')).toBe(404)
    expect(httpStatusFor('VALIDATION')).toBe(422)
    expect(httpStatusFor('CONFLICT')).toBe(409)
    expect(httpStatusFor('UPLOAD_TOO_LARGE')).toBe(413)
    expect(httpStatusFor('UNSUPPORTED_FILE_TYPE')).toBe(415)
    expect(httpStatusFor('PROVIDER_UNAVAILABLE')).toBe(503)
    expect(httpStatusFor('INTERNAL')).toBe(500)
  })

  it('appError keeps the message it was given', () => {
    expect(appError('CONFLICT', 'Already applied').message).toBe('Already applied')
  })
})
```

- [ ] **Step 2: Run and confirm both fail**

Run: `npm test -- result errors`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `errors.ts` then `result.ts`** to the signatures in the Interfaces block.

- [ ] **Step 4: Run and confirm they pass**

Run: `npm test -- result errors`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Result type and application error taxonomy"
```

---

## Task 3: Prisma schema for all four phases

**Files:**
- Create: `prisma/schema.prisma`, `src/lib/db/prisma.ts`
- Modify: `package.json` (add `db:generate`, `db:migrate`, `db:push`, `db:seed`, `db:studio` scripts; add `prisma.seed` config)
- Test: `tests/unit/schema.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the generated Prisma client, imported everywhere as `import { prisma } from '@/lib/db/prisma'`. Enum names used by every later task: `Role`, `JobCategory`, `ExperienceLevel`, `WorkMode`, `JobType`, `JobStatus`, `ModerationStatus`, `ApplicationStage`, `NotificationType`, `ReportTargetType`, `ReportStatus`.

**Models and the relationships that matter.** `User.id` is the Supabase auth UUID — not a generated cuid — because that is the join between the two systems.

- `User` — `id String @id`, `email @unique`, `name`, `role Role @default(CANDIDATE)`, `avatarUrl?`, `onboardedAt DateTime?`, timestamps; optional one-to-one `candidateProfile`, `employerProfile`; `notifications`, `sentMessages`, `conversations`, `reportsFiled`.
- `CandidateProfile` — `userId @unique`, `headline?`, `location?`, `bio?`, `experienceLevel ExperienceLevel`, `primarySector JobCategory`; owns `preference JobPreference?`, `experiences`, `educations`, `skills`, `certifications`, `links`, `resumes`, `applications`, `savedJobs`.
- `JobPreference` — `candidateProfileId @unique`, `targetRole?`, `preferredLocation?`, `minSalaryBdt Int?`, `workMode WorkMode @default(ANY)`, `jobType JobType @default(FULL_TIME)`.
- `Experience`, `Education`, `Certification`, `Link` — ordinary child rows with `candidateProfileId` and an `order Int @default(0)`.
- `Skill` — `candidateProfileId`, `name`, `@@unique([candidateProfileId, name])`.
- `Company` — `name @unique`, `logoInitials`, `sector JobCategory`, `size?`, `website?`, `about?`, `verified Boolean @default(false)`; owns `jobs`, `employers`.
- `EmployerProfile` — `userId @unique`, `companyId`, `title?`.
- `Job` — `companyId`, `postedById` (User), `title`, `category JobCategory`, `location`, `workMode`, `jobType`, `salaryMinBdt Int?`, `salaryMaxBdt Int?`, `salaryNote?`, `summary`, `responsibilities String[]`, `requirements String[]`, `preferredSkills String[]`, `requiredSkills String[]`, `status JobStatus @default(DRAFT)`, `moderation ModerationStatus @default(PENDING)`, `publishedAt?`, `closesAt?`, timestamps; indexes on `[status, category]` and `[companyId]`.
- `Application` — `candidateProfileId`, `jobId`, `resumeId?`, `coverLetter?`, `screeningAnswers Json`, `consentedAt`, `stage ApplicationStage @default(APPLIED)`, timestamps, **`@@unique([candidateProfileId, jobId])`** — the database, not the service, is what makes double-applying impossible; owns `events ApplicationEvent[]`.
- `ApplicationEvent` — `applicationId`, `fromStage?`, `toStage`, `note?`, `actorId?`, `createdAt`. The tracker renders this history, so a stage change must always write one.
- `Resume` — `candidateProfileId`, `label`, `storagePath @unique`, `fileName`, `mimeType`, `sizeBytes Int`, `extractedText?`, `isPrimary Boolean @default(false)`, `version Int`, timestamps.
- `SavedJob` — `candidateProfileId`, `jobId`, `@@unique([candidateProfileId, jobId])`.
- `Conversation` + `ConversationParticipant` + `Message` — participants join `User`; `Message` has `conversationId`, `senderId`, `body`, `readAt?`.
- `Notification` — `userId`, `type NotificationType`, `title`, `body`, `href?`, `readAt?`.
- `Report` — `reporterId`, `targetType ReportTargetType`, `targetId`, `reason`, `detail?`, `status ReportStatus @default(OPEN)`, `resolvedById?`, `resolutionNote?`.
- `AiInteraction` — `userId?`, `feature String`, `providerId String`, `attempts Json`, `promptTokens Int?`, `completionTokens Int?`, `latencyMs Int`, `createdAt`. Makes provider failover auditable in P2.

Datasource uses `url = env("DATABASE_URL")` (pooled) and `directUrl = env("DIRECT_URL")` — Vercel's serverless functions need the pooler, migrations need the direct connection.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/schema.test.ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const schema = readFileSync('prisma/schema.prisma', 'utf8')

describe('prisma schema', () => {
  it('keys User on the Supabase auth uid rather than generating one', () => {
    expect(schema).toMatch(/model User \{[\s\S]*?id\s+String\s+@id(?!\s*@default)/)
  })

  it('makes double-applying impossible at the database level', () => {
    expect(schema).toContain('@@unique([candidateProfileId, jobId])')
  })

  it('configures a direct url so migrations bypass the pooler', () => {
    expect(schema).toContain('directUrl = env("DIRECT_URL")')
  })

  it('declares every enum later phases depend on', () => {
    for (const e of [
      'Role', 'JobCategory', 'ExperienceLevel', 'WorkMode', 'JobType',
      'JobStatus', 'ModerationStatus', 'ApplicationStage', 'NotificationType',
      'ReportTargetType', 'ReportStatus',
    ]) {
      expect(schema).toContain(`enum ${e} {`)
    }
  })
})
```

- [ ] **Step 2: Run and confirm it fails**

Run: `npm test -- schema`
Expected: FAIL — `prisma/schema.prisma` does not exist.

- [ ] **Step 3: Write the schema** to the model list above.

- [ ] **Step 4: Write the Prisma singleton**

```ts
// src/lib/db/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 5: Validate and generate**

Run: `npx prisma validate && npx prisma generate`
Expected: "The schema at prisma/schema.prisma is valid" and a generated client.

- [ ] **Step 6: Run the schema tests**

Run: `npm test -- schema`
Expected: PASS, 4 tests.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add the full Prisma schema and client singleton"
```

---

## Task 4: Supabase clients and config

**Files:**
- Create: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/middleware.ts`, `src/lib/env.ts`
- Create: `.env.example`
- Test: `tests/unit/env.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `createServerSupabase(): Promise<SupabaseClient>` — reads/writes the Next cookie store; used by server components and server actions.
  - `createBrowserSupabase(): SupabaseClient` — singleton for client components.
  - `updateSession(request: NextRequest): Promise<{ response: NextResponse; userId: string | null }>` — refreshes the session and reports who the caller is, so `middleware.ts` can route without a second round trip.
  - `serverEnv` and `publicEnv` — Zod-parsed, so a missing variable fails at boot with the variable's name instead of at the first query with `undefined`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/env.test.ts
import { describe, expect, it } from 'vitest'
import { serverEnvSchema } from '@/lib/env'

describe('serverEnvSchema', () => {
  it('names the missing variable instead of failing silently', () => {
    const result = serverEnvSchema.safeParse({})
    expect(result.success).toBe(false)
    if (!result.success) {
      const missing = result.error.issues.map((i) => i.path.join('.'))
      expect(missing).toContain('DATABASE_URL')
      expect(missing).toContain('SUPABASE_SERVICE_ROLE_KEY')
    }
  })

  it('rejects a Supabase URL that is not a url', () => {
    const result = serverEnvSchema.safeParse({
      DATABASE_URL: 'postgresql://x',
      DIRECT_URL: 'postgresql://x',
      NEXT_PUBLIC_SUPABASE_URL: 'not-a-url',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'k',
      SUPABASE_SERVICE_ROLE_KEY: 'k',
    })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run and confirm it fails**

Run: `npm test -- env`
Expected: FAIL — `@/lib/env` not found.

- [ ] **Step 3: Implement `env.ts`, then the three Supabase clients** using `@supabase/ssr`'s `createServerClient` / `createBrowserClient` with the `getAll`/`setAll` cookie adapter.

- [ ] **Step 4: Write `.env.example`** documenting every variable with a one-line comment saying exactly where in the Supabase dashboard to find it, plus the four AI provider keys (all optional — the chain adapts to whichever exist) and the `AI_PROVIDER_ORDER` override.

- [ ] **Step 5: Run the test**

Run: `npm test -- env`
Expected: PASS, 2 tests.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add validated env config and Supabase server/browser clients"
```

---

## Task 5: Roles, session and guards

**Files:**
- Create: `src/lib/auth/roles.ts`, `src/lib/auth/session.ts`, `src/lib/auth/guards.ts`
- Create: `src/lib/db/repositories/user.repository.ts`
- Test: `tests/unit/roles.test.ts`, `tests/unit/guards.test.ts`

**Interfaces:**
- Consumes: `Result`/`AppError` (Task 2), `prisma` (Task 3), `createServerSupabase` (Task 4).
- Produces:
  - `homePathFor(role: Role): string` — `CANDIDATE` → `/dashboard`, `EMPLOYER` → `/employer`, `ADMIN` → `/admin`.
  - `type RouteGroup = 'marketing' | 'auth' | 'candidate' | 'employer' | 'admin'`
  - `routeGroupFor(pathname: string): RouteGroup`
  - `canAccess(role: Role, group: RouteGroup): boolean` — admins may enter any group; candidates only `candidate`; employers only `employer`; everyone may enter `marketing`/`auth`.
  - `type SessionUser = { id: string; email: string; name: string; role: Role; onboardedAt: Date | null }`
  - `getCurrentUser(): Promise<SessionUser | null>` — **returns `null` when a Supabase session exists but no `User` row does** (Review Focus 1).
  - `requireUser(): Promise<SessionUser>` — redirects to `/login` when null.
  - `requireRole(role: Role): Promise<SessionUser>` — redirects to the caller's own home when the role mismatches.
  - `requireOnboarded(): Promise<SessionUser>` — redirects to `/onboarding` or `/company-setup` when `onboardedAt` is null.
  - `findUserById(id)`, `createUserWithRole({ id, email, name, role })`, `markOnboarded(id)` in the repository.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/roles.test.ts
import { describe, expect, it } from 'vitest'
import { homePathFor, routeGroupFor, canAccess } from '@/lib/auth/roles'

describe('homePathFor', () => {
  it('sends each role to its own workspace', () => {
    expect(homePathFor('CANDIDATE')).toBe('/dashboard')
    expect(homePathFor('EMPLOYER')).toBe('/employer')
    expect(homePathFor('ADMIN')).toBe('/admin')
  })
})

describe('routeGroupFor', () => {
  it('classifies the routes each role group owns', () => {
    expect(routeGroupFor('/')).toBe('marketing')
    expect(routeGroupFor('/jobs-public')).toBe('marketing')
    expect(routeGroupFor('/login')).toBe('auth')
    expect(routeGroupFor('/onboarding')).toBe('auth')
    expect(routeGroupFor('/dashboard')).toBe('candidate')
    expect(routeGroupFor('/jobs/12')).toBe('candidate')
    expect(routeGroupFor('/employer')).toBe('employer')
    expect(routeGroupFor('/post-job')).toBe('employer')
    expect(routeGroupFor('/admin')).toBe('admin')
    expect(routeGroupFor('/admin/users')).toBe('admin')
  })

  it('does not confuse /admin with a candidate route that merely starts similarly', () => {
    expect(routeGroupFor('/administrative-notes')).not.toBe('admin')
  })
})

describe('canAccess', () => {
  // Review Focus 3
  it('refuses a candidate the employer and admin groups', () => {
    expect(canAccess('CANDIDATE', 'employer')).toBe(false)
    expect(canAccess('CANDIDATE', 'admin')).toBe(false)
    expect(canAccess('CANDIDATE', 'candidate')).toBe(true)
  })

  it('refuses an employer the candidate and admin groups', () => {
    expect(canAccess('EMPLOYER', 'candidate')).toBe(false)
    expect(canAccess('EMPLOYER', 'admin')).toBe(false)
    expect(canAccess('EMPLOYER', 'employer')).toBe(true)
  })

  it('lets an admin into every group', () => {
    for (const g of ['marketing', 'auth', 'candidate', 'employer', 'admin'] as const) {
      expect(canAccess('ADMIN', g)).toBe(true)
    }
  })

  it('lets every role into marketing and auth', () => {
    for (const r of ['CANDIDATE', 'EMPLOYER', 'ADMIN'] as const) {
      expect(canAccess(r, 'marketing')).toBe(true)
      expect(canAccess(r, 'auth')).toBe(true)
    }
  })
})
```

```ts
// tests/unit/guards.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getUser = vi.fn()
const findUserById = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: async () => ({ auth: { getUser } }),
}))
vi.mock('@/lib/db/repositories/user.repository', () => ({ findUserById }))

const { getCurrentUser } = await import('@/lib/auth/session')

describe('getCurrentUser', () => {
  beforeEach(() => {
    getUser.mockReset()
    findUserById.mockReset()
  })

  it('returns null when there is no Supabase session', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect(await getCurrentUser()).toBeNull()
  })

  // Review Focus 1: signup interrupted between auth creation and the profile row
  it('returns null when a session exists but the User row does not', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'uid-1' } }, error: null })
    findUserById.mockResolvedValue(null)
    expect(await getCurrentUser()).toBeNull()
  })

  it('returns the session user when both exist', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'uid-1' } }, error: null })
    findUserById.mockResolvedValue({
      id: 'uid-1', email: 'a@b.com', name: 'A', role: 'CANDIDATE', onboardedAt: null,
    })
    const user = await getCurrentUser()
    expect(user?.role).toBe('CANDIDATE')
    expect(user?.onboardedAt).toBeNull()
  })
})
```

- [ ] **Step 2: Run and confirm they fail**

Run: `npm test -- roles guards`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `roles.ts`, `user.repository.ts`, `session.ts`, `guards.ts`** to the Interfaces block. `routeGroupFor` must match on full path segments, not `startsWith` on a bare string, or the `/administrative-notes` test fails.

- [ ] **Step 4: Run and confirm they pass**

Run: `npm test -- roles guards`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add role model, session resolution and route guards"
```

---

## Task 6: Middleware — session refresh and route protection

**Files:**
- Create: `src/middleware.ts`
- Test: `tests/unit/middleware-decision.test.ts`
- Create: `src/lib/auth/route-decision.ts`

**Interfaces:**
- Consumes: `routeGroupFor`, `canAccess`, `homePathFor` (Task 5), `updateSession` (Task 4).
- Produces: `decideRoute(input: { pathname: string; role: Role | null; onboarded: boolean }): { action: 'allow' } | { action: 'redirect'; to: string }`.

The decision is extracted from `middleware.ts` into a pure function because middleware itself cannot be unit-tested without a request harness, and this is exactly the logic that must not be wrong.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/middleware-decision.test.ts
import { describe, expect, it } from 'vitest'
import { decideRoute } from '@/lib/auth/route-decision'

const anon = { role: null, onboarded: false }

describe('decideRoute', () => {
  it('lets anyone see marketing pages', () => {
    expect(decideRoute({ pathname: '/', ...anon })).toEqual({ action: 'allow' })
    expect(decideRoute({ pathname: '/jobs-public', ...anon })).toEqual({ action: 'allow' })
  })

  it('sends an anonymous visitor from a protected page to login', () => {
    expect(decideRoute({ pathname: '/dashboard', ...anon }))
      .toEqual({ action: 'redirect', to: '/login' })
    expect(decideRoute({ pathname: '/employer', ...anon }))
      .toEqual({ action: 'redirect', to: '/login' })
  })

  // Review Focus 3
  it('sends a candidate who opens an employer URL to their own home', () => {
    expect(decideRoute({ pathname: '/post-job', role: 'CANDIDATE', onboarded: true }))
      .toEqual({ action: 'redirect', to: '/dashboard' })
  })

  it('sends an employer who opens a candidate URL to their own home', () => {
    expect(decideRoute({ pathname: '/dashboard', role: 'EMPLOYER', onboarded: true }))
      .toEqual({ action: 'redirect', to: '/employer' })
  })

  it('refuses a non-admin the admin group', () => {
    expect(decideRoute({ pathname: '/admin/users', role: 'EMPLOYER', onboarded: true }))
      .toEqual({ action: 'redirect', to: '/employer' })
  })

  it('pushes a signed-in but un-onboarded candidate into onboarding', () => {
    expect(decideRoute({ pathname: '/dashboard', role: 'CANDIDATE', onboarded: false }))
      .toEqual({ action: 'redirect', to: '/onboarding' })
  })

  it('pushes a signed-in but un-onboarded employer into company setup', () => {
    expect(decideRoute({ pathname: '/employer', role: 'EMPLOYER', onboarded: false }))
      .toEqual({ action: 'redirect', to: '/company-setup' })
  })

  it('lets an un-onboarded user stay on their onboarding page', () => {
    expect(decideRoute({ pathname: '/onboarding', role: 'CANDIDATE', onboarded: false }))
      .toEqual({ action: 'allow' })
  })

  it('sends a signed-in user away from login and signup', () => {
    expect(decideRoute({ pathname: '/login', role: 'CANDIDATE', onboarded: true }))
      .toEqual({ action: 'redirect', to: '/dashboard' })
    expect(decideRoute({ pathname: '/signup', role: 'ADMIN', onboarded: true }))
      .toEqual({ action: 'redirect', to: '/admin' })
  })

  it('does not bounce an onboarded user back into onboarding', () => {
    expect(decideRoute({ pathname: '/onboarding', role: 'CANDIDATE', onboarded: true }))
      .toEqual({ action: 'redirect', to: '/dashboard' })
  })
})
```

- [ ] **Step 2: Run and confirm it fails**

Run: `npm test -- middleware-decision`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `decideRoute`**, then `middleware.ts` wiring `updateSession` → look up role → `decideRoute` → allow or redirect. The `config.matcher` must exclude `_next/static`, `_next/image`, `favicon.ico`, and asset extensions so static files skip the database lookup.

- [ ] **Step 4: Run and confirm it passes**

Run: `npm test -- middleware-decision`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: protect route groups by role and onboarding state in middleware"
```

---

## Task 7: Config — categories, navigation, constants

**Files:**
- Create: `src/config/categories.ts`, `src/config/constants.ts`, `src/config/nav.ts`
- Test: `tests/unit/categories.test.ts`

**Interfaces:**
- Consumes: Prisma enums (Task 3), `homePathFor` (Task 5).
- Produces:
  - `CATEGORIES: readonly { value: JobCategory; label: string; glyph: string }[]` — the 11 real categories in the prototype's order, with its exact glyphs: Technology `⌘`, Marketing `◎`, Sales `↗`, Finance `৳`, HR `◉`, Design `✦`, Operations `▦`, Customer Support `☏`, Healthcare `✚`, Education `▤`, Other `＋`.
  - `categoryLabel(value: JobCategory): string`, `categoryGlyph(value: JobCategory): string`
  - `EXPERIENCE_LEVELS`, `WORK_MODES`, `JOB_TYPES`, `APPLICATION_STAGES` — `{ value, label }[]` for selects.
  - `STAGE_TONE: Record<ApplicationStage, 'applied' | 'interview' | 'offer' | 'reject'>` — drives the prototype's four status-chip colors.
  - `MAX_RESUME_BYTES = 10 * 1024 * 1024`, `ACCEPTED_RESUME_MIME = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']`
  - `navFor(role: Role): { section: string; items: { href: string; label: string; glyph: string }[] }[]`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/categories.test.ts
import { describe, expect, it } from 'vitest'
import { CATEGORIES, categoryLabel, categoryGlyph } from '@/config/categories'
import { STAGE_TONE } from '@/config/constants'
import { navFor } from '@/config/nav'

describe('categories', () => {
  it('covers every JobCategory enum value exactly once', () => {
    const values = CATEGORIES.map((c) => c.value)
    expect(new Set(values).size).toBe(values.length)
    expect(values).toHaveLength(11)
  })

  it('keeps the prototype labels and glyphs', () => {
    expect(categoryLabel('CUSTOMER_SUPPORT')).toBe('Customer Support')
    expect(categoryLabel('HR')).toBe('HR')
    expect(categoryGlyph('FINANCE')).toBe('৳')
    expect(categoryGlyph('TECHNOLOGY')).toBe('⌘')
  })
})

describe('STAGE_TONE', () => {
  it('gives every application stage a chip tone', () => {
    for (const stage of [
      'APPLIED', 'SCREENING', 'INTERVIEW', 'ASSESSMENT', 'OFFER', 'REJECTED', 'WITHDRAWN',
    ] as const) {
      expect(STAGE_TONE[stage]).toBeDefined()
    }
  })
})

describe('navFor', () => {
  it('gives each role a distinct, non-empty navigation', () => {
    for (const role of ['CANDIDATE', 'EMPLOYER', 'ADMIN'] as const) {
      const sections = navFor(role)
      expect(sections.length).toBeGreaterThan(0)
      expect(sections.flatMap((s) => s.items).length).toBeGreaterThan(0)
    }
  })

  it('never offers a candidate an employer destination', () => {
    const hrefs = navFor('CANDIDATE').flatMap((s) => s.items.map((i) => i.href))
    expect(hrefs).not.toContain('/post-job')
    expect(hrefs).not.toContain('/employer')
  })
})
```

- [ ] **Step 2: Run and confirm it fails**

Run: `npm test -- categories`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the three config files.**

- [ ] **Step 4: Run and confirm it passes**

Run: `npm test -- categories`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add category, constant and navigation configuration"
```

---

## Task 8: UI primitives

**Files:**
- Create under `src/components/ui/`: `button.tsx`, `card.tsx`, `badge.tsx`, `input.tsx`, `select.tsx`, `textarea.tsx`, `field.tsx`, `status-chip.tsx`, `score-ring.tsx`, `progress.tsx`, `avatar.tsx`, `empty-state.tsx`, `stepper.tsx`, `upload-box.tsx`, `toast.tsx`, `index.ts`
- Create: `src/lib/utils/format.ts`
- Test: `tests/unit/format.test.ts`, `tests/unit/score-ring.test.ts`

**Interfaces:**
- Consumes: `cn` (Task 1).
- Produces:
  - `<Button variant="primary" | "dark" | "soft" | "ghost" | "mint" size="sm" | "md" href?={string} loading?={boolean}>` — renders `<a>` when `href` is given, `<button>` otherwise.
  - `<Card padded?>`, `<Badge tone="blue" | "mint" | "dark" | "warn">`, `<Input>`, `<Select options={{value,label}[]}>`, `<Textarea>`
  - `<Field label error?={string[]} hint?>` — wraps a control and renders Zod field errors; every form in every later task uses this, so error display is uniform.
  - `<StatusChip stage={ApplicationStage}>`, `<ScoreRing score={number} size?>`, `<Progress value={number}>`, `<Avatar name={string} src?>`, `<EmptyState glyph title body action?>`, `<Stepper steps={string[]} current={number}>`, `<UploadBox accept maxBytes onFile>`
  - `formatTaka(min?: number | null, max?: number | null, note?: string | null): string` — `৳45k–65k` style, matching the prototype.
  - `relativeTime(date: Date, now?: Date): string` — `2h ago`, `Today`, `3d ago`.
  - `initials(name: string): string` — max 2 characters.
  - `clampScore(score: number): number` — 0–100, non-finite → 0. `ScoreRing` must not emit a broken `conic-gradient` for a bad score.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/format.test.ts
import { describe, expect, it } from 'vitest'
import { formatTaka, relativeTime, initials } from '@/lib/utils/format'

describe('formatTaka', () => {
  it('renders a range in the prototype style', () => {
    expect(formatTaka(45000, 65000)).toBe('৳45k–65k')
  })
  it('renders an open-ended minimum', () => {
    expect(formatTaka(30000, null)).toBe('৳30k+')
  })
  it('appends a note when one is given', () => {
    expect(formatTaka(30000, 45000, 'incentive')).toBe('৳30k–45k + incentive')
  })
  it('says nothing rather than ৳0 when there is no salary', () => {
    expect(formatTaka(null, null)).toBe('Negotiable')
  })
})

describe('relativeTime', () => {
  const now = new Date('2026-09-23T12:00:00Z')
  it('uses hours within the day', () => {
    expect(relativeTime(new Date('2026-09-23T10:00:00Z'), now)).toBe('2h ago')
  })
  it('says Today for the same hour', () => {
    expect(relativeTime(new Date('2026-09-23T11:45:00Z'), now)).toBe('Today')
  })
  it('uses days beyond a day', () => {
    expect(relativeTime(new Date('2026-09-20T12:00:00Z'), now)).toBe('3d ago')
  })
})

describe('initials', () => {
  it('takes at most two initials', () => {
    expect(initials('Ayesha Karim')).toBe('AK')
    expect(initials('Mohammad Rafat Ur Rahman')).toBe('MR')
  })
  it('handles a single name', () => {
    expect(initials('Nusrat')).toBe('N')
  })
  it('does not crash on an empty name', () => {
    expect(initials('')).toBe('')
    expect(initials('   ')).toBe('')
  })
})
```

```ts
// tests/unit/score-ring.test.ts
import { describe, expect, it } from 'vitest'
import { clampScore } from '@/lib/utils/format'

describe('clampScore', () => {
  it('passes a normal score through', () => {
    expect(clampScore(92)).toBe(92)
  })
  it('clamps out-of-range scores into the ring', () => {
    expect(clampScore(140)).toBe(100)
    expect(clampScore(-5)).toBe(0)
  })
  it('treats a non-finite score as zero rather than emitting broken CSS', () => {
    expect(clampScore(Number.NaN)).toBe(0)
    expect(clampScore(Number.POSITIVE_INFINITY)).toBe(100)
  })
  it('rounds fractional scores', () => {
    expect(clampScore(87.6)).toBe(88)
  })
})
```

- [ ] **Step 2: Run and confirm they fail**

Run: `npm test -- format score-ring`
Expected: FAIL — `@/lib/utils/format` not found.

- [ ] **Step 3: Implement `format.ts`.**

- [ ] **Step 4: Run and confirm they pass**

Run: `npm test -- format score-ring`
Expected: PASS, 14 tests.

- [ ] **Step 5: Build the 15 primitives** to the prop signatures above, styling each to match its `legacy/styles.css` counterpart (`.btn`/`.btn-primary`, `.card`, `.badge`, `.input`, `.status`, `.score-ring`, `.progress`, `.avatar`, `.stepper`/`.step`, `.upload-box`). `toast.tsx` provides a `ToastProvider` + `useToast()` replacing the prototype's global `toast()`.

- [ ] **Step 6: Verify the build and types**

Run: `npm run typecheck && npm run build`
Expected: both succeed.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add UI primitives and formatting helpers matching the prototype"
```

---

## Task 9: Layout shell

**Files:**
- Create: `src/components/layout/app-shell.tsx`, `sidebar.tsx`, `topbar.tsx`, `public-nav.tsx`, `footer.tsx`, `page-head.tsx`, `brand.tsx`
- Create: `src/app/(candidate)/layout.tsx`, `src/app/(employer)/layout.tsx`, `src/app/(admin)/layout.tsx`
- Create: `src/app/error.tsx`, `src/app/not-found.tsx`
- Create: `src/server/services/auth.service.ts` (the `signOut` action used by the sidebar)
- Test: `tests/unit/sidebar-active.test.ts`

**Interfaces:**
- Consumes: `navFor` (Task 7), `requireOnboarded` (Task 5), UI primitives (Task 8).
- Produces:
  - `<AppShell user={SessionUser} accent?={'candidate' | 'employer' | 'admin'}>` — the 248px/1fr grid.
  - `<Sidebar sections={...} pathname={string} user={SessionUser}>`
  - `<Topbar user searchPlaceholder?>`
  - `<PageHead title description? actions?>`
  - `isNavItemActive(itemHref: string, pathname: string): boolean` — exact match, or a `/jobs` item active on `/jobs/12`, but `/admin` **not** active on `/admin/users` when a `/admin/users` item also exists.
  - `signOutAction(): Promise<void>` — server action; signs out of Supabase and redirects to `/`.

Each role layout calls `requireOnboarded()` then renders `AppShell`, so no page under a group has to repeat the guard. Review Focus 5 is satisfied here too: `requireUser` redirecting means an expired cookie yields a redirect, not a thrown error.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/sidebar-active.test.ts
import { describe, expect, it } from 'vitest'
import { isNavItemActive } from '@/components/layout/sidebar'

describe('isNavItemActive', () => {
  it('marks an exact match active', () => {
    expect(isNavItemActive('/dashboard', '/dashboard')).toBe(true)
  })
  it('marks a parent active on its detail page', () => {
    expect(isNavItemActive('/jobs', '/jobs/12')).toBe(true)
  })
  it('does not mark a sibling active', () => {
    expect(isNavItemActive('/jobs', '/saved')).toBe(false)
  })
  it('does not treat a shared prefix as a match', () => {
    expect(isNavItemActive('/job', '/jobs')).toBe(false)
  })
  it('keeps the root of a group inactive on a deeper sibling route', () => {
    expect(isNavItemActive('/admin', '/admin/users')).toBe(false)
  })
})
```

- [ ] **Step 2: Run and confirm it fails**

Run: `npm test -- sidebar-active`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `isNavItemActive` and the layout components.** The sidebar is `bg-navy` with `.side-link.active` carrying `box-shadow: inset 3px 0 0 var(--color-mint)`; the employer sidebar uses the `.employer-accent` gradient. The topbar is 72px, `sticky`, `backdrop-blur`.

- [ ] **Step 4: Run and confirm it passes**

Run: `npm test -- sidebar-active`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add the app shell, role sidebars and error boundaries"
```

---

## Task 10: Marketing pages

**Files:**
- Create: `src/app/(marketing)/layout.tsx`, `src/app/(marketing)/page.tsx`, `src/app/(marketing)/jobs-public/page.tsx`
- Create: `src/components/marketing/hero.tsx`, `sector-grid.tsx`, `feature-grid.tsx`, `ai-section.tsx`, `stats-bar.tsx`
- Create: `src/components/jobs/job-card.tsx`
- Create: `src/lib/db/repositories/job.repository.ts` (read-only: `listPublishedJobs`, `countJobsByCategory`)

**Interfaces:**
- Consumes: `CATEGORIES` (Task 7), UI primitives (Task 8), `prisma` (Task 3).
- Produces:
  - `<JobCard job={JobCardModel} score?={number} saved?={boolean} onToggleSave?>` where `type JobCardModel = { id: string; title: string; companyName: string; logoInitials: string; category: JobCategory; location: string; jobType: JobType; salaryLabel: string; skills: string[]; postedLabel: string; applicantCount: number }`. P1 reuses this exact type.
  - `listPublishedJobs(filter?): Promise<JobCardModel[]>`
  - `countJobsByCategory(): Promise<Record<JobCategory, number>>`

The landing page ports `legacy/app.js:landing()` section for section: hero with the floating mock window, stats bar, sector grid, candidate feature grid, navy AI section, employer call-to-action, footer. `/jobs-public` lists real database jobs — this is the first page proving the database works end to end.

- [ ] **Step 1: Build the marketing layout, `PublicNav` and `Footer`, and the landing sections.**

- [ ] **Step 2: Build the repository reads and `/jobs-public`.**

- [ ] **Step 3: Verify the build**

Run: `npm run typecheck && npm run build`
Expected: both succeed.

- [ ] **Step 4: Verify in a browser**

Run: `npm run dev`, open `http://localhost:3000`.
Expected: the landing page is visually indistinguishable from `legacy/index.html` — same navy/blue/mint, same Manrope headings, same card shadows, same hero mock. `/jobs-public` lists the seeded jobs.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: port the landing page and public job browse onto real data"
```

---

## Task 11: Signup, login and sign-out

**Files:**
- Create: `src/app/(auth)/layout.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`
- Create: `src/components/auth/auth-form.tsx`, `role-picker.tsx`
- Create: `src/lib/validation/auth.schema.ts`
- Modify: `src/server/services/auth.service.ts`
- Test: `tests/unit/auth-schema.test.ts`, `tests/integration/auth.service.test.ts`

**Interfaces:**
- Consumes: `Result`/`AppError` (Task 2), `createServerSupabase` (Task 4), `user.repository` (Task 5), `Field` (Task 8).
- Produces:
  - `signupSchema` — `{ name: min 2, email: email, password: min 8, role: 'CANDIDATE' | 'EMPLOYER' }`. `ADMIN` is **not** accepted: admin is provisioned by database update, so a crafted POST cannot self-promote.
  - `loginSchema` — `{ email, password: min 1 }`
  - `signupAction(prev, formData): Promise<AuthFormState>` and `loginAction(prev, formData)` — server actions for `useActionState`, where `type AuthFormState = { fieldErrors?: Record<string, string[]>; formError?: string; values?: { name?: string; email?: string } }`. `values` is echoed back so a rejected submit does not clear the form (Review Focus 2).
  - `signUp(input): Promise<Result<{ userId: string; role: Role }>>` in the service: creates the Supabase auth user, then the `User` row in one transaction-like sequence; on a duplicate email returns `CONFLICT` with `'That email is already registered. Sign in instead.'`

- [ ] **Step 1: Write the failing schema tests**

```ts
// tests/unit/auth-schema.test.ts
import { describe, expect, it } from 'vitest'
import { signupSchema, loginSchema } from '@/lib/validation/auth.schema'

describe('signupSchema', () => {
  const valid = { name: 'Rafat', email: 'a@b.com', password: 'longenough1', role: 'CANDIDATE' }

  it('accepts a valid candidate signup', () => {
    expect(signupSchema.safeParse(valid).success).toBe(true)
  })

  it('refuses a password shorter than 8 characters', () => {
    const r = signupSchema.safeParse({ ...valid, password: 'short' })
    expect(r.success).toBe(false)
  })

  it('refuses a malformed email', () => {
    expect(signupSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false)
  })

  it('refuses self-assignment of the ADMIN role', () => {
    expect(signupSchema.safeParse({ ...valid, role: 'ADMIN' }).success).toBe(false)
  })

  it('refuses a blank name', () => {
    expect(signupSchema.safeParse({ ...valid, name: ' ' }).success).toBe(false)
  })
})

describe('loginSchema', () => {
  it('accepts an email and any non-empty password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true)
  })
  it('refuses an empty password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Write the failing service test for the duplicate-email path (Review Focus 2)**

```ts
// tests/integration/auth.service.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const signUpMock = vi.fn()
const createUserWithRole = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: async () => ({ auth: { signUp: signUpMock } }),
}))
vi.mock('@/lib/db/repositories/user.repository', () => ({ createUserWithRole, findUserById: vi.fn() }))

const { signUp } = await import('@/server/services/auth.service')

describe('signUp', () => {
  beforeEach(() => {
    signUpMock.mockReset()
    createUserWithRole.mockReset()
  })

  it('returns CONFLICT with a readable message for an already-registered email', async () => {
    signUpMock.mockResolvedValue({
      data: { user: null },
      error: { message: 'User already registered', status: 422 },
    })
    const result = await signUp({ name: 'A', email: 'a@b.com', password: 'longenough1', role: 'CANDIDATE' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('CONFLICT')
      expect(result.error.message).toMatch(/already registered/i)
    }
    expect(createUserWithRole).not.toHaveBeenCalled()
  })

  it('creates the User row with the requested role on success', async () => {
    signUpMock.mockResolvedValue({ data: { user: { id: 'uid-9' } }, error: null })
    createUserWithRole.mockResolvedValue({ id: 'uid-9', role: 'EMPLOYER' })
    const result = await signUp({ name: 'B', email: 'b@c.com', password: 'longenough1', role: 'EMPLOYER' })
    expect(result.ok).toBe(true)
    expect(createUserWithRole).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'uid-9', email: 'b@c.com', role: 'EMPLOYER' }),
    )
  })

  it('does not create a User row when Supabase returns no user', async () => {
    signUpMock.mockResolvedValue({ data: { user: null }, error: null })
    const result = await signUp({ name: 'C', email: 'c@d.com', password: 'longenough1', role: 'CANDIDATE' })
    expect(result.ok).toBe(false)
    expect(createUserWithRole).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run and confirm both fail**

Run: `npm test -- auth-schema auth.service`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement the schemas, the service and the actions.**

- [ ] **Step 5: Run and confirm they pass**

Run: `npm test -- auth-schema auth.service`
Expected: PASS, 10 tests.

- [ ] **Step 6: Build the login and signup pages**, porting `legacy/app.js:auth()` — split layout with the navy visual panel left, form card right, role picker on signup only, Google button present but disabled with a "coming soon" title.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add real signup, login and sign-out on Supabase Auth"
```

---

## Task 12: Onboarding and company setup

**Files:**
- Create: `src/app/(auth)/onboarding/page.tsx`, `src/app/(auth)/company-setup/page.tsx`
- Create: `src/components/auth/onboarding-wizard.tsx`
- Create: `src/lib/validation/onboarding.schema.ts`
- Create: `src/lib/db/repositories/candidate.repository.ts`, `company.repository.ts`
- Create: `src/server/services/onboarding.service.ts`
- Test: `tests/unit/onboarding-schema.test.ts`, `tests/integration/onboarding.service.test.ts`

**Interfaces:**
- Consumes: `CATEGORIES` (Task 7), `Stepper` (Task 8), `requireUser` (Task 5), `markOnboarded` (Task 5).
- Produces:
  - `onboardingSchema` — `{ primarySector: JobCategory, targetRole?: string, experienceLevel: ExperienceLevel, preferredLocation?: string, jobType: JobType, minSalaryBdt?: number, workMode: WorkMode }`
  - `companySetupSchema` — `{ companyName: min 2, sector: JobCategory, size?: string, website?: url, about?: string, title?: string }`
  - `completeOnboarding(userId, input): Promise<Result<void>>` — creates `CandidateProfile` + `JobPreference`, sets `onboardedAt`.
  - `completeCompanySetup(userId, input): Promise<Result<void>>` — finds or creates the `Company`, creates `EmployerProfile`, sets `onboardedAt`.

The wizard is a client component holding the 5 steps in local state and submitting once at the end, so a half-finished wizard writes nothing. Step order matches the prototype: sector → preferences → CV upload (P0 shows the box and explains it activates in P2) → profile review → ready.

- [ ] **Step 1: Write the failing schema test (Review Focus 4)**

```ts
// tests/unit/onboarding-schema.test.ts
import { describe, expect, it } from 'vitest'
import { onboardingSchema, companySetupSchema } from '@/lib/validation/onboarding.schema'

const valid = {
  primarySector: 'TECHNOLOGY',
  experienceLevel: 'ENTRY',
  jobType: 'FULL_TIME',
  workMode: 'ANY',
}

describe('onboardingSchema', () => {
  it('accepts the minimum valid onboarding', () => {
    expect(onboardingSchema.safeParse(valid).success).toBe(true)
  })

  // Review Focus 4: hand-crafted POST with a sector that is not a category
  it('refuses a sector outside the category enum', () => {
    const r = onboardingSchema.safeParse({ ...valid, primarySector: 'ASTROLOGY' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toEqual(['primarySector'])
  })

  it('refuses a missing sector', () => {
    const { primarySector, ...rest } = valid
    expect(onboardingSchema.safeParse(rest).success).toBe(false)
  })

  it('refuses a negative salary floor', () => {
    expect(onboardingSchema.safeParse({ ...valid, minSalaryBdt: -1 }).success).toBe(false)
  })

  it('coerces a salary submitted as a form string', () => {
    const r = onboardingSchema.safeParse({ ...valid, minSalaryBdt: '35000' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.minSalaryBdt).toBe(35000)
  })
})

describe('companySetupSchema', () => {
  it('accepts a minimal company', () => {
    expect(companySetupSchema.safeParse({ companyName: 'Nexa Labs', sector: 'TECHNOLOGY' }).success).toBe(true)
  })
  it('refuses a one-character company name', () => {
    expect(companySetupSchema.safeParse({ companyName: 'N', sector: 'TECHNOLOGY' }).success).toBe(false)
  })
  it('refuses a website that is not a url', () => {
    const r = companySetupSchema.safeParse({ companyName: 'Nexa Labs', sector: 'TECHNOLOGY', website: 'nope' })
    expect(r.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run and confirm it fails**

Run: `npm test -- onboarding-schema`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the schemas, repositories, service and the wizard.**

- [ ] **Step 4: Run and confirm it passes**

Run: `npm test -- onboarding-schema onboarding.service`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add candidate onboarding and employer company setup"
```

---

## Task 13: Role dashboards

**Files:**
- Create: `src/app/(candidate)/dashboard/page.tsx`
- Create: `src/app/(employer)/employer/page.tsx`
- Create: `src/app/(admin)/admin/page.tsx`
- Create: `src/components/ui/metric-card.tsx`, `src/components/ai/ai-banner.tsx`, `src/components/ui/quick-actions.tsx`

**Interfaces:**
- Consumes: `AppShell` (Task 9), `Card`/`Progress`/`EmptyState` (Task 8), repositories (Tasks 10, 12).
- Produces: `<MetricCard label value trend?>`, `<AiBanner title body cta?>`, `<QuickActions items={{href,glyph,title,subtitle}[]}>`.

Each dashboard renders its real counts — which in P0 are legitimately zero for a new account — using `EmptyState` rather than fake numbers. The candidate dashboard shows profile-completeness from actual profile fields, the recommended-jobs slot shows seeded jobs, and the AI banner links to `/ai-coach` marked as arriving in P2. This is the honest version of `legacy/app.js:dashboard()`.

- [ ] **Step 1: Build the three dashboards and the three components.**

- [ ] **Step 2: Verify the build**

Run: `npm run typecheck && npm run build && npm test`
Expected: all succeed.

- [ ] **Step 3: Verify every role in a browser**

Run: `npm run dev`. Sign up as a candidate, complete onboarding, reach `/dashboard`. Sign up as an employer, complete company setup, reach `/employer`. Promote one user to `ADMIN` with `npx prisma studio` and reach `/admin`. Then, signed in as the candidate, type `/post-job` in the address bar.
Expected: each role reaches its own dashboard; the candidate typing `/post-job` is redirected to `/dashboard` (Review Focus 3).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add candidate, employer and admin dashboards on real counts"
```

---

## Task 14: Seed, documentation and deployment

**Files:**
- Create: `prisma/seed.ts`
- Create: `README.md`
- Modify: `.env.example`
- Create: `vercel.json` only if a build-command override proves necessary

**Interfaces:**
- Consumes: `prisma` (Task 3), `CATEGORIES` (Task 7).
- Produces: `npm run db:seed` — idempotent (`upsert` throughout, so running it twice does not duplicate), inserting the prototype's 12 jobs across a handful of companies, a demo candidate, a demo employer and a demo admin.

- [ ] **Step 1: Write the seed script** porting the 12 jobs from `legacy/app.js` (titles, companies, categories, locations, salaries, skills, summaries, responsibilities, requirements, preferred) so the deployed app is populated on first load.

- [ ] **Step 2: Run it against the Supabase database**

Run: `npm run db:migrate && npm run db:seed`
Expected: migration applied, seed reports rows created. Run the seed a second time and confirm counts do not double.

- [ ] **Step 3: Write the README** — what the project is, the layer rules from the spec §3.2, the folder map, local setup, and a numbered "go live" section covering exactly the four things only the user can do: create the Supabase project and copy five values, create the free AI keys, create the GitHub repo and push, connect Vercel and paste the environment variables. Include the literal commands for each.

- [ ] **Step 4: Full verification**

Run: `npm test && npm run typecheck && npm run build`
Expected: all green. Record the actual output; do not claim success without it.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add idempotent seed data and go-live documentation"
```

---

## Self-Review

**Spec coverage.** §3.1 shape → Task 1. §3.2 layers → enforced by Global Constraints, realised across Tasks 5–13. §3.3 auth → Tasks 4, 5, 6, 11. §3.4 Prisma → Task 3. §3.5 AI chain → **P2, deliberately deferred**; Task 13 marks the AI surfaces as arriving then. §3.6 storage → **P2**; Task 12 shows the upload box inert. §3.7 matching → **P1/P2**; Task 10's `JobCardModel` carries an optional `score` so the field exists before the scorer does. §4 data model → Task 3 in full. §5 design system → Tasks 1, 8, 9, 10. §6 file structure → the File Structure table. §7 error handling → Tasks 2, 9 (`error.tsx`), 11/12 (double validation). §8 testing → test steps throughout. §9 what Claude cannot do → Task 14 Step 3.

**Placeholder scan.** No TBD/TODO. Every code step carries real code or a named, precise instruction with the exact file and the exact prototype function to port.

**Type consistency.** `SessionUser` (Task 5) is what `AppShell` (Task 9) takes and what `requireUser`/`requireRole`/`requireOnboarded` return. `JobCardModel` (Task 10) is what `listPublishedJobs` returns and what `JobCard` takes, and P1 reuses it. `Result`/`AppError` from Task 2 is every service's return type in Tasks 11–12. `AuthFormState` (Task 11) is the single `useActionState` shape. `decideRoute` (Task 6) consumes `routeGroupFor`/`canAccess`/`homePathFor` from Task 5 under those exact names.

**Review Focus coverage.** (1) no-User-row → `tests/unit/guards.test.ts`. (2) duplicate email → `tests/integration/auth.service.test.ts`. (3) cross-role URL → `tests/unit/roles.test.ts` + `tests/unit/middleware-decision.test.ts` + Task 13 Step 3 manual check. (4) invalid sector → `tests/unit/onboarding-schema.test.ts`. (5) expired session mid-submit → `requireUser` redirect semantics, asserted through the guard tests and the layout guard in Task 9.
