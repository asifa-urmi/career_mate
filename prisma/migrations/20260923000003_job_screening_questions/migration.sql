-- Screening questions on a job.
--
-- Defaults to an empty array so the twelve seeded jobs, and any job created
-- before this migration, remain valid without a backfill.
ALTER TABLE "public"."Job"
  ADD COLUMN "screeningQuestions" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "public"."Job" SET "screeningQuestions" = ARRAY[]::TEXT[]
  WHERE "screeningQuestions" IS NULL;

ALTER TABLE "public"."Job"
  ALTER COLUMN "screeningQuestions" SET NOT NULL;
