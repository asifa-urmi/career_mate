# CareerMate

A multi-sector recruitment platform: job discovery, applications, CV management
and AI career assistance, with separate workspaces for candidates, employers and
platform administrators.

Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4,
Prisma and Supabase. Deploys to Vercel.

The original HTML/CSS/JS prototype lives in [`legacy/`](legacy/) as the visual
reference. Its design is carried over; none of its code is.

---

## Where things are

Requests flow one way. Each layer only knows the layer below it.

```
src/components/       React components — props only, no data fetching
src/app/              Route groups: guard, call a service, render
src/server/services/  Business rules, authorization, orchestration
src/lib/db/repositories/   Prisma queries
src/lib/ai/           AI provider chain: adapters, router, prompts, schemas
src/lib/matching/     Match scoring — computed in code, never by a model
src/lib/supabase/     Auth clients and storage
```

Three rules keep it that way, and they are worth enforcing in review:

1. **No component imports Prisma, a Supabase client, or a service.** Components
   take props and callbacks, which is what makes them renderable and testable on
   their own.
2. **Only `src/lib/db/repositories/` imports `prisma`.** A service that needs
   data calls a repository function; swapping the ORM touches one folder.
3. **Only services decide authorization.** A page asks "who is this" through a
   guard, then hands the user to a service, which decides whether they may do the
   thing.
4. **No feature names an AI provider.** It asks the router for a completion;
   only `src/lib/ai/providers/` knows Gemini or Groq exists. Adding a provider is
   one adapter file and one line of ordering.
5. **Match scores are computed, never generated.** A score that changed when a
   quota ran out would not be a score. The AI narrates the evidence the scorer
   produces; it never produces the number.

| Path | What lives there |
|---|---|
| `src/app/(marketing)/` | Landing page, public job board |
| `src/app/(auth)/` | Login, signup, onboarding, company setup |
| `src/app/(candidate)/` | Dashboard, jobs, applications, CV, profile |
| `src/app/(employer)/` | Overview, post job, candidates, pipeline |
| `src/app/(admin)/` | Platform overview, users, moderation, reports |
| `src/app/(shared)/` | Settings and notifications — every signed-in role |
| `src/config/` | Categories, navigation, constants |
| `src/lib/auth/` | Roles, session, guards, routing policy |
| `src/lib/validation/` | Zod schemas, shared by browser and server |
| `prisma/` | Schema, migrations, seed |
| `tests/` | Vitest suites |

## Commands

```bash
npm run dev         # development server on :3000
npm run build       # production build (runs prisma generate first)
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run db:migrate  # create and apply a migration
npm run db:seed     # load the twelve demo jobs (idempotent)
npm run db:studio   # browse the database
```

---

## Going live

Five of these steps need your own accounts and credentials. Everything else is
already in the repository.

### 1. Create the Supabase project

Sign up at [supabase.com](https://supabase.com) and create a project. Choose a
region close to your users and **save the database password** — you need it in
the next step and it is not shown again.

Then collect five values:

- **Connect** (top bar) → **ORMs** → **Prisma**: gives you `DATABASE_URL` (the
  pooled connection, port 6543) and `DIRECT_URL` (the direct connection, port
  5432). Replace `[YOUR-PASSWORD]` in both.
- **Settings** → **API Keys**: the Project URL, the `anon public` key and the
  `service_role` key.

Copy `.env.example` to `.env.local` and fill them in:

```bash
cp .env.example .env.local
```

The `service_role` key bypasses row-level security. It is used only on the
server. Never prefix it with `NEXT_PUBLIC_`.

### 2. Create the database tables

The migrations are committed, so this applies reviewed SQL rather than
generating new SQL on your machine:

```bash
npm run db:deploy
```

That runs every committed migration in order. The first creates the tables. The
second is the one that matters for safety: **`20260923000001_rls_deny_all`**.

Supabase grants every table in the `public` schema to the `anon` role by
default, and the anon key is deliberately public — it ships inside the browser
bundle. Prisma creates tables with row-level security switched off. Without that
second migration, anyone with your site's public key could read every row
through Supabase's REST API, and could `PATCH` their own `User` row to
`role: "ADMIN"` — a complete takeover, because every permission check in the app
reads the role from exactly that row.

This app never uses that REST API; all database access goes through Prisma on
the server, behind service-layer authorization. So the migration enables and
forces RLS on every table, revokes the public grants, and creates no policies at
all. Nothing is reachable through the public API.

A migration that adds a table carries its own deny-all block, and
`tests/unit/rls-migration.test.ts` reads every migration and fails if any table
created by any of them is missing one — so a table added later cannot quietly
escape it.

`npm test` fails if a future table is added without the same treatment.

Then load the demo jobs so the site is not empty on its first visit:

```bash
npm run db:seed
```

The seed is idempotent — running it twice updates rather than duplicates. The
employer accounts it creates own the seeded jobs but have no Supabase auth
identity, so they cannot be signed into. Create your own account at `/signup`.

Check it worked:

```bash
npm run dev
```

Open <http://localhost:3000>. The landing page should show live sector counts and
the public board should list twelve roles.

### 3. Create the CV storage bucket

Supabase dashboard -> **Storage** -> **New bucket**:

- Name: `resumes`
- **Public bucket: OFF.** This matters. CVs carry full names, work history and
  often a phone number; a public bucket makes every one of them readable by
  anyone with the URL.

Nothing else to configure. The app never serves a file directly — it decides who
may read one (a candidate their own; an employer only a CV attached to an
application to their own company's job) and then mints a link that expires in two
minutes.

### 4. Add the AI keys (optional, and optional by design)

Every key is optional. A provider counts as available only when its key is
present, and the router tries them in order — moving to the next on a rate limit,
an exhausted quota, a server error, a timeout or a response it cannot parse. A
provider that reports a rate limit is skipped for a minute and an exhausted quota
for fifteen, rather than being retried on every request and adding its round trip
to all of them.

With no keys at all the app still works. It falls through to a deterministic
local provider, and every answer it gives says the assistant is unavailable, with
the UI labelling it plainly as not AI-generated. A plausible-sounding generic
reply would be worse than none, because someone would act on it.

Sign up for as many free tiers as you like — that is the point of the chain.

| Order | Provider | Free tier | Where to get a key |
|---|---|---|---|
| 1 | Google Gemini | Most generous | <https://aistudio.google.com/apikey> |
| 2 | Groq | Smaller, very fast | <https://console.groq.com/keys> |
| 3 | Mistral | Modest | <https://console.mistral.ai/api-keys> |
| 4 | OpenRouter | Has `:free` models | <https://openrouter.ai/keys> |
| 5 | Offline fallback | Always | built in, no key |

Change the order with `AI_PROVIDER_ORDER="groq,gemini"` if you prefer. The
fallback is appended whatever you write, so a typo cannot leave the chain without
a floor.

Which provider answered is shown on every AI panel, so when one runs out you can
see the change rather than guess at it. Every request is also recorded in the
`AiInteraction` table with the providers that failed first.

### 5. Push to GitHub

```bash
git remote add origin https://github.com/YOUR-USERNAME/careermate.git
git push -u origin main
```

`.gitignore` already excludes `.env`, `.env.local` and `node_modules`. Check
`git status` before pushing if you are unsure.

### 6. Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
2. Framework preset: **Next.js** (detected automatically). Set the **Build
   Command** to `npm run vercel-build`, which applies any pending migrations
   before building. Without it, a deploy that adds a migration ships code whose
   tables do not exist yet.
3. Under **Environment Variables**, add every required variable from
   `.env.example`: `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, plus any AI keys.
4. Deploy.

Then, in Supabase → **Authentication** → **URL Configuration**, set the Site URL
to your Vercel domain so confirmation and password-reset links point at the live
site rather than localhost. Add the same domain under **Redirect URLs**.

### 6b. Decide how signup confirms an email

Supabase creates a project with **Confirm email** switched on, which is the
right default for a live site but the first thing that will confuse you while
testing. With it on, `/signup` returns "check your inbox" and no session exists
until the link is clicked — the app handles this and says so, rather than
appearing to succeed and then bouncing you.

Two things to know:

- Supabase's built-in email sender is rate-limited to a handful of messages an
  hour and is meant for testing, not for real users. Before you have real
  signups, set your own SMTP under **Authentication → Emails → SMTP Settings**.
- To try the app end to end without waiting on mail, turn **Confirm email** off
  under **Authentication → Sign In / Providers → Email** while you are testing,
  and turn it back on before anyone else uses the site. Leaving it off in
  production lets anyone sign up as an address they do not own.

### 7. Make yourself an admin

Admin accounts are deliberately not creatable through signup — the signup form
does not accept the role, so a crafted request cannot mint one.

Sign up normally, then promote your account:

```bash
npm run db:studio
```

Open the `User` table, find your row, change `role` to `ADMIN`, and save. Sign
out and back in. `/admin` is now reachable.

---

## What is built

| Phase | Status | Contents |
|---|---|---|
| **P0 Foundation** | Done | Design system, schema, auth with three roles, route protection, onboarding, marketing pages, job board, dashboards |
| **P1 Core loop** | Done | Job detail, saved jobs, apply flow, application tracker, candidate profile, employer job posting and management, candidate review with stage transitions, company profile, notifications |
| **P2 CV + AI** | Done | CV upload, versions and private storage with signed links, text extraction, the failover AI provider chain, match scoring, match explanations, CV review, cover letters, interview prep |
| **P3 Remainder** | Done | Two-sided messaging threaded per application, notification centre, employer pipeline board, hiring analytics, admin user and job moderation, the report queue, account settings, data export and deletion |

Every destination the sidebar offers is a built page. A test walks the nav for
all three roles and fails if a link has no page behind it, or if the page it
finds is still a placeholder.

The design document and implementation plans are in
[`docs/superpowers/`](docs/superpowers/).

## Notes

- `npm audit` reports three advisories in `deepmerge-ts` via `@prisma/config`.
  The affected code merges our own Prisma configuration at CLI invocation; no
  user input reaches it. Silencing it means pinning the Prisma CLI back seven
  minor versions, which forgoes real fixes.
- Prisma is held at 6.x on purpose. In 7.x, `@prisma/client` takes a runtime
  dependency on the CLI, which pulls `mysql2` and its advisories into the
  production dependency tree of a Postgres-only app.
