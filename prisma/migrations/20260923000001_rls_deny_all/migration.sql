-- Deny-all Row Level Security.
--
-- WHY THIS MIGRATION EXISTS
--
-- Supabase grants every table in `public` to the `anon` and `authenticated`
-- roles by default, and the anon key is inlined into the browser bundle by
-- design. Prisma creates tables with RLS switched off. Without this migration a
-- visitor can read every row through PostgREST:
--
--   GET /rest/v1/User?select=*   with the public anon key
--
-- and, worse, write them:
--
--   PATCH /rest/v1/User?id=eq.<their uid>   {"role":"ADMIN"}
--
-- which is a complete platform takeover, because every guard reads `role` from
-- exactly that row.
--
-- This application never talks to PostgREST. All database access goes through
-- Prisma on the server, as the `postgres` role, behind service-layer
-- authorization. So the correct posture is: nothing is reachable through the
-- public API at all.
--
--   ENABLE + FORCE  - RLS applies even to the table owner, so a future policy
--                     cannot be bypassed by connecting as `postgres`.
--   REVOKE          - what actually makes a leaked anon key inert: with no
--                     grants, PostgREST cannot see the table regardless of RLS.
--
-- No policies are created. Adding one later is how a table is deliberately
-- opened up; until then, deny-all is the default.


-- The two roles below belong to Supabase, not to Postgres. The REVOKE
-- statements name them directly, and Postgres refuses to revoke from a role
-- that does not exist, so on a plain Postgres — a local machine, a CI runner —
-- this migration aborted here with `role "anon" does not exist` and the deploy
-- stopped dead. The app could then only ever be run against Supabase.
--
-- Creating them when missing is a no-op on Supabase, where they already exist,
-- and lets the same committed SQL apply everywhere. NOLOGIN and no grants: they
-- exist only so the revokes below have something to revoke.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
END
$$;

ALTER TABLE "public"."AiInteraction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AiInteraction" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."AiInteraction" FROM anon, authenticated;

ALTER TABLE "public"."Application" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Application" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."Application" FROM anon, authenticated;

ALTER TABLE "public"."ApplicationEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ApplicationEvent" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."ApplicationEvent" FROM anon, authenticated;

ALTER TABLE "public"."CandidateProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CandidateProfile" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."CandidateProfile" FROM anon, authenticated;

ALTER TABLE "public"."Certification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Certification" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."Certification" FROM anon, authenticated;

ALTER TABLE "public"."Company" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Company" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."Company" FROM anon, authenticated;

ALTER TABLE "public"."Conversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Conversation" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."Conversation" FROM anon, authenticated;

ALTER TABLE "public"."ConversationParticipant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ConversationParticipant" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."ConversationParticipant" FROM anon, authenticated;

ALTER TABLE "public"."Education" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Education" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."Education" FROM anon, authenticated;

ALTER TABLE "public"."EmployerProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."EmployerProfile" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."EmployerProfile" FROM anon, authenticated;

ALTER TABLE "public"."Experience" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Experience" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."Experience" FROM anon, authenticated;

ALTER TABLE "public"."Job" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Job" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."Job" FROM anon, authenticated;

ALTER TABLE "public"."JobPreference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."JobPreference" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."JobPreference" FROM anon, authenticated;

ALTER TABLE "public"."Link" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Link" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."Link" FROM anon, authenticated;

ALTER TABLE "public"."Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Message" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."Message" FROM anon, authenticated;

ALTER TABLE "public"."Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Notification" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."Notification" FROM anon, authenticated;

ALTER TABLE "public"."Report" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Report" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."Report" FROM anon, authenticated;

ALTER TABLE "public"."Resume" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Resume" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."Resume" FROM anon, authenticated;

ALTER TABLE "public"."SavedJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SavedJob" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."SavedJob" FROM anon, authenticated;

ALTER TABLE "public"."Skill" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Skill" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."Skill" FROM anon, authenticated;

ALTER TABLE "public"."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."User" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."User" FROM anon, authenticated;

-- Future tables inherit the same posture, so a migration added later cannot
-- silently reopen the public API.
ALTER DEFAULT PRIVILEGES IN SCHEMA "public" REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
