# CareerMate — Production Rebuild Design

**Date:** 2026-09-23
**Status:** Approved for implementation
**Supersedes:** the HTML/CSS/JS prototype now preserved in `legacy/`

---

## 1. Intent

### What the user asked for

Rebuild the CareerMate prototype as a real, deployed product: **React + Node.js**,
keeping the prototype's visual design, with a **real backend** — authentication,
database, CV file upload, and AI features. Deploy to **Vercel**. Database:
**Supabase**. AI: **3–4 free-tier providers chained**, so that when one provider's
free quota is exhausted the next one takes over. Old prototype kept under
`legacy/` as the design reference. Build all phases P0 → P3 continuously.

### What success looks like

A person can open a public URL, create a real account, complete onboarding,
search real jobs from a database, upload a real CV file, apply to a job, and
watch that application move through stages — while an employer account sees
that application arrive and moves it through a hiring pipeline. AI features
answer with real model output and keep working after any single provider's
free tier runs out.

### Stated constraints

- Visual design must match the prototype (colors, type, layout, component look).
- Supabase for database. Vercel for hosting.
- AI must survive free-tier exhaustion by falling through to other providers.
- The user creates their own accounts and supplies their own API keys; Claude
  never creates accounts or handles credentials.

### Assumptions (not stated by the user — correct these if wrong)

- Single region deployment; Bangladesh-facing content (৳ salaries, Dhaka
  locations) as in the prototype, English UI.
- Email + password authentication is enough for P0; Google OAuth is a later
  nice-to-have, wired but optional.
- "Messaging" means near-real-time enough via polling or Supabase Realtime, not
  a hard sub-second SLA.
- CV parsing means extracting text + best-effort structured fields, not a
  guaranteed-accurate resume parser.
- Admin accounts are provisioned by direct database update, not self-signup.

---

## 2. Scope decomposition

The request covers roughly ten independent subsystems. They ship in four
phases; each phase ends deployable and usable.

| Phase | Subsystems | Definition of done |
|---|---|---|
| **P0 Foundation** | Project scaffold, design system, DB schema, auth + roles, app shell, public marketing pages, onboarding | A stranger can sign up, pick a role, complete onboarding, and land in an empty but real dashboard. Live on Vercel. |
| **P1 Core loop** | Job catalog + search/filter, job detail, apply flow, application tracker, saved jobs, employer post-job + manage-jobs + candidate review | A candidate can apply to a real job; the employer sees the application and changes its stage. |
| **P2 CV + AI** | Resume upload/storage/versions, CV text extraction, AI provider chain, match explanation, CV review, career coach, interview prep, JD assist | CV upload persists to Supabase Storage; AI features answer from a real model and fail over between providers. |
| **P3 Remainder** | Messaging, notifications, hiring pipeline board, analytics, admin moderation + reports | Candidate↔employer messaging works; admin can moderate jobs and act on reports. |

---

## 3. Architecture

### 3.1 Shape

**Next.js 15 (App Router) + TypeScript, single repo, single Vercel deployment.**

React is the frontend; Next.js Route Handlers and Server Actions are the
Node.js backend. This satisfies "React + Node.js" without a second host to
operate, and the App Router's file-based routing maps the prototype's 30 hash
routes onto real URLs that are linkable, crawlable and refresh-safe.

Rejected: separate Vite SPA + standalone Express server. It doubles the
deployment surface (Vercel + Render/Railway), adds CORS and session-cookie
complexity across origins, and buys nothing this product needs.

Rejected: keeping vanilla JS. The prototype's 78KB of template-literal HTML
with inline `onclick` handlers cannot carry real state, real auth or real data
fetching without becoming unmaintainable.

### 3.2 Layers and their contracts

Requests flow in one direction. Each layer only knows the layer below it.

```
React components (src/components)
        │  props only — no data fetching, no db, no supabase
        ▼
Route groups / pages (src/app)
        │  auth guard, then call a service; render
        ▼
Services (src/server/services)
        │  business rules, authorization, orchestration
        ▼
Repositories (src/lib/db/repositories)   AI router (src/lib/ai)   Storage (src/lib/supabase/storage)
        │  Prisma queries only                │ provider failover        │ signed URLs
        ▼                                     ▼                          ▼
   Supabase Postgres                   Gemini/Groq/Mistral/…      Supabase Storage
```

**Rules that make this hold:**

- Components never import Prisma, the Supabase client, or a service. They take
  props and callbacks. This keeps them independently renderable and testable.
- Only repositories touch Prisma. A service that needs data calls a repository
  function; it never writes a query. Swapping the ORM touches one folder.
- Only services make authorization decisions. A page asks "who is this user"
  via the auth guard, then hands the user to a service; the service decides
  whether that user may do the thing.
- The AI router is the only thing that knows a provider exists. Features ask
  for a completion; they never name Gemini or Groq.

### 3.3 Authentication and authorization

**Supabase Auth** issues and refreshes sessions; `@supabase/ssr` keeps them in
HTTP-only cookies so both server components and route handlers can read them.
`src/middleware.ts` refreshes the session on every request and redirects
unauthenticated users away from protected route groups.

Each Supabase auth user has exactly one `User` row in Postgres, keyed by the
auth user's UUID, holding `role` (`CANDIDATE` | `EMPLOYER` | `ADMIN`) and the
profile relations. Role lives in our table, not in the JWT, so an employer
cannot mint themselves an admin token.

Authorization is explicit in code, in the service layer — `requireRole`,
`requireOwnership`, `canViewApplication`. Row Level Security is enabled on
every table with deny-all policies as defense in depth: only the server, using
the service role key, reaches the database, so a leaked anon key grants
nothing. We do not encode business rules in RLS policies, because a 3-role
platform's rules are too subtle to express safely in SQL and impossible to
unit-test.

### 3.4 Data access

**Prisma** over Supabase Postgres, through the pooled (pgBouncer) connection
string that Vercel's serverless functions require, with `DIRECT_URL` for
migrations. Prisma gives a single reviewable schema file, generated types that
make the service layer type-safe end to end, and portability off Supabase if
that is ever wanted.

### 3.5 AI provider chain

The core of the user's AI requirement. `src/lib/ai/` holds:

- `providers/*.ts` — one adapter per provider, each exporting the same
  interface: `{ id, label, isConfigured(), complete(request) }`. A provider is
  "configured" when its API key env var is present, so the chain adapts to
  whatever keys exist without a code change.
- `router.ts` — tries configured providers in priority order. On a retryable
  failure (429 rate limit, 402/quota exhausted, 5xx, timeout, network error) it
  records the reason and advances to the next provider. On a non-retryable
  failure (malformed request, content refusal) it stops. Returns the completion
  plus which provider served it and what was tried, so failures are visible
  rather than silent.
- `providers/mock.ts` — last in the chain, always configured, returns
  deterministic canned output. Guarantees the app never 500s because every free
  tier is dry, and makes AI features testable without network access.
- `prompts/` — one file per feature, prompt text separate from orchestration.
- `schemas.ts` — Zod schemas for structured AI output. A response that does not
  parse counts as a retryable failure, so a provider returning malformed JSON
  fails over instead of corrupting the UI.

Default order (free tiers, most generous first): **Gemini → Groq → Mistral →
OpenRouter → mock.** Order is env-configurable.

Short-term failure memory: a provider that returns 429 or a quota error is
skipped for a cooldown window instead of being retried on every request, so one
exhausted provider does not add latency to every later call.

### 3.6 File storage

CV files go to a **private** Supabase Storage bucket. Uploads are validated
server-side for MIME type and size (PDF/DOCX, ≤10MB) before being written under
`resumes/{userId}/{resumeId}/{filename}`. Downloads are served through
short-lived signed URLs minted by a route handler that first checks the
requester may see that file — a candidate sees their own CVs, an employer sees
only CVs attached to an application submitted to one of their own jobs.

### 3.7 Match scoring

A deterministic, testable scorer in `src/lib/matching/` compares a candidate
profile against a job across weighted dimensions (skill overlap, experience
level, location/work-mode fit, salary overlap, sector match) and returns both a
0–100 score and per-dimension evidence. The score is computed in code, not by
the model, so it is stable and explainable. AI then narrates that evidence in
prose. This preserves the prototype's stated rule — AI explains and suggests,
it does not invent qualifications — and it means match scores do not change
when the AI provider changes.

---

## 4. Data model

Core entities and the relationships that matter:

- **User** — auth UUID, email, role, name. One-to-one with `CandidateProfile`
  or `EmployerProfile` depending on role.
- **CandidateProfile** — headline, location, experience level, bio, plus
  `JobPreference` (target role, sector, salary floor, work mode, job type) and
  collections of `Experience`, `Education`, `Skill`, `Certification`, `Link`.
- **EmployerProfile** — belongs to a **Company** (name, logo initials, sector,
  size, website, verified flag, about).
- **Job** — company, title, category, location, work mode, job type, salary
  range, summary, responsibilities, requirements, preferred skills, required
  skills, status (`DRAFT`/`PUBLISHED`/`CLOSED`), moderation status, timestamps.
- **Application** — candidate + job (unique together, so one application per
  job per candidate), the `Resume` version used, screening answers, cover
  letter, consent record, `stage` (`APPLIED`/`SCREENING`/`INTERVIEW`/
  `ASSESSMENT`/`OFFER`/`REJECTED`/`WITHDRAWN`), plus an `ApplicationEvent`
  history so the tracker shows real transitions rather than a current value.
- **Resume** — owner, label, storage path, file metadata, extracted text,
  `isPrimary`, version number. Multiple per candidate.
- **SavedJob** — candidate + job, unique together.
- **Conversation** / **Message** — participants, body, read state.
- **Notification** — user, type, payload, read state.
- **Report** — reporter, target (job or user), reason, status — feeds the admin
  safety queue.
- **AiInteraction** — feature, provider that served it, token counts, latency.
  Makes provider failover observable and cost visible.

Seed data ports the prototype's 12 jobs, 12 categories and 5 candidates so the
rebuilt app looks alive from the first deploy.

---

## 5. Design system

The prototype's design is preserved exactly by lifting its tokens into Tailwind
v4 theme variables rather than re-deriving them:

| Token | Value |
|---|---|
| navy / navy-2 | `#0a1533` / `#101f47` |
| blue / blue-2 | `#2f6bff` / `#5d8bff` |
| mint / mint-soft | `#3ed6b2` / `#dffaf3` |
| bg / surface | `#f5f7fb` / `#ffffff` |
| text / muted / line | `#111a33` / `#69738c` / `#e5e9f2` |
| danger / warning | `#ff5f72` / `#f9b94f` |
| radius / radius-sm | `18px` / `12px` |
| shadow | `0 14px 45px rgba(17,36,84,.10)` |
| shadow-sm | `0 6px 18px rgba(17,36,84,.08)` |
| fonts | Inter (body), Manrope (headings) |

Distinctive prototype elements that must survive the rebuild, because they are
the design's identity: the 248px fixed navy sidebar with a mint inset bar on
the active link; the blurred sticky 72px topbar; the `conic-gradient` score
ring; the 12-column content grid; the gradient AI banner with its ghost `✦`;
the dashed CV upload box; the pill status chips; the gradient profile cover with
its overlapping avatar; and the CSS-only bar chart with its grow animation.

Each becomes a React component in `src/components/ui/` or
`src/components/layout/`, styled with those tokens.

---

## 6. File structure

```
careermate_demo/
├─ legacy/                          # original prototype, design reference
├─ docs/superpowers/specs/          # this spec, and the implementation plan
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  └─ seed.ts
├─ src/
│  ├─ app/
│  │  ├─ (marketing)/               # /, /jobs-public
│  │  ├─ (auth)/                    # /login, /signup, /onboarding, /company-setup
│  │  ├─ (candidate)/               # /dashboard /jobs /jobs/[id] /apply/[id] /tracker
│  │  │                             # /saved /resume /ai-coach /messages /profile
│  │  │                             # /notifications /settings
│  │  ├─ (employer)/                # /employer /post-job /manage-jobs /candidates
│  │  │                             # /candidates/[id] /pipeline /analytics
│  │  │                             # /company-profile /employer/messages
│  │  ├─ (admin)/                   # /admin /admin/users /admin/jobs /admin/reports
│  │  ├─ api/                       # route handlers (upload, ai, signed-url, webhooks)
│  │  ├─ layout.tsx
│  │  └─ globals.css                # design tokens
│  ├─ components/
│  │  ├─ ui/                        # Button Card Badge Input Select Textarea Modal
│  │  │                             # Toast Tabs ScoreRing Progress StatusChip
│  │  │                             # EmptyState Stepper UploadBox BarChart Avatar
│  │  ├─ layout/                    # AppShell Sidebar Topbar PublicNav Footer PageHead
│  │  ├─ jobs/ applications/ resume/ ai/ messages/ employer/ admin/ profile/
│  ├─ server/
│  │  └─ services/                  # auth job application resume ai matching
│  │                                # message notification admin analytics
│  ├─ lib/
│  │  ├─ ai/                        # providers/ router.ts prompts/ schemas.ts
│  │  ├─ auth/                      # session.ts guards.ts roles.ts
│  │  ├─ db/                        # prisma.ts repositories/
│  │  ├─ supabase/                  # server.ts client.ts middleware.ts storage.ts
│  │  ├─ matching/                  # score.ts explain.ts weights.ts
│  │  ├─ validation/                # zod schemas per domain
│  │  └─ utils/                     # format.ts cn.ts errors.ts result.ts
│  ├─ config/                       # categories.ts nav.ts constants.ts
│  ├─ types/
│  └─ middleware.ts
├─ tests/
│  ├─ unit/                         # ai router, matching, validation, guards
│  └─ integration/                  # service + repository against a test database
├─ .env.example
└─ README.md
```

Folder boundaries mirror the layer contracts in §3.2, so an import that crosses
a boundary the wrong way is visible in review.

---

## 7. Error handling

- **Expected failures return values, not exceptions.** Services return a
  `Result<T, AppError>` for outcomes the UI must render differently — duplicate
  application, job closed, quota exceeded, file too large. Pages branch on the
  result; they never parse error strings.
- **Unexpected failures throw** and are caught by route-group `error.tsx`
  boundaries, so one broken widget does not blank the app.
- **Validation happens twice:** the same Zod schema validates in the browser for
  fast feedback and again on the server, which is the only one that is trusted.
- **AI failures are the normal case, not the exception.** Every provider being
  exhausted still produces a usable response via the mock provider, with the UI
  saying the answer is a fallback rather than pretending it is model output.
- **Never trust user text as HTML.** React escapes by default; the one place
  that must render rich text (AI markdown output) goes through a sanitizer with
  an allowlist. This closes the prototype's unused-`esc()` XSS hole.

---

## 8. Testing

Tests go where they catch real defects, not everywhere for symmetry.

- **Unit (Vitest), test-first** — the AI router's failover order, cooldown and
  retryable/non-retryable classification; the match scorer's per-dimension
  weights and edge cases; Zod schemas; authorization guards. These are pure
  functions with branchy logic and real consequences when wrong, so they are
  written test-first.
- **Integration (Vitest)** — services against a real test database: applying
  twice is rejected, stage transitions record events, an employer cannot read
  another company's applications, signed-URL authorization refuses the wrong
  requester.
- **Component** — only for components with real logic (stepper, upload
  validation, filter state). Presentational components are verified by eye
  against the prototype, not by snapshot.
- **Manual verification per phase** — each phase ends with the dev server run
  and its flows exercised in a browser before it is called done.

---

## 9. What Claude cannot do

Account creation and credential entry are out of bounds. For the deployment to
exist, the user must personally:

1. Create a Supabase project and copy its URL, anon key, service role key and
   both connection strings.
2. Create free-tier AI API keys (Google AI Studio, Groq, Mistral, OpenRouter).
3. Create a GitHub repository and push.
4. Connect that repository to Vercel and paste the environment variables.

Claude prepares everything else: all code, `.env.example` documenting every
variable, the Prisma migrations, the seed script, the Vercel configuration, and
exact copy-paste commands for each step above.

---

## 10. Out of scope

Payments and subscriptions. Employer verification workflows. Email delivery
(notifications are in-app only). Mobile apps. Multi-language UI. Résumé
parsing accuracy guarantees. Video interviews. Background checks. Anything
requiring a paid API tier.
