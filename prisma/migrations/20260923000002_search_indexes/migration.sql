-- Trigram indexes for the job board's free-text search.
--
-- The search runs `ILIKE '%term%'` across title, summary and company name. A
-- btree index cannot serve a leading wildcard, so without this every keystroke
-- submitted is a sequential scan over the whole jobs table joined to companies.
-- It is imperceptible at twelve rows and unusable at fifty thousand.
--
-- pg_trgm indexes the three-character sequences in a string, which is exactly
-- what a substring match needs. Supabase ships the extension; CREATE EXTENSION
-- is idempotent.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Job_title_trgm_idx"
  ON "public"."Job" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Job_summary_trgm_idx"
  ON "public"."Job" USING GIN ("summary" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Company_name_trgm_idx"
  ON "public"."Company" USING GIN ("name" gin_trgm_ops);

-- Skill search uses array containment (`hasSome`), which GIN serves directly.
CREATE INDEX IF NOT EXISTS "Job_requiredSkills_idx"
  ON "public"."Job" USING GIN ("requiredSkills");

CREATE INDEX IF NOT EXISTS "Job_preferredSkills_idx"
  ON "public"."Job" USING GIN ("preferredSkills");
