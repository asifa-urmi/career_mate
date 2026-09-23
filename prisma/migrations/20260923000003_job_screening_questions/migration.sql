-- Screening questions on a job.
--
-- The DEFAULT is only there so the column can be added to a table that already
-- has rows; Postgres 11+ backfills existing rows as part of ADD COLUMN, so no
-- separate UPDATE is needed. It is dropped again afterwards, because
-- schema.prisma declares no default for this column and leaving one would show
-- as drift on the next `prisma migrate dev`.
ALTER TABLE "public"."Job"
  ADD COLUMN "screeningQuestions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "public"."Job"
  ALTER COLUMN "screeningQuestions" DROP DEFAULT;
