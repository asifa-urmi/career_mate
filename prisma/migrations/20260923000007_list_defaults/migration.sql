-- Every list column defaults to empty.
--
-- Prisma types a scalar list as OPTIONAL on a create, but Postgres made these
-- columns NOT NULL with no default. So a create that omitted one typechecked
-- cleanly and then failed at runtime with a null constraint violation — which
-- is what the seed did with "screeningQuestions", invisibly, until it met a
-- real database.
--
-- An empty list is also the honest value: a job that asks no screening
-- questions asks none. It does not have an unknown number of them.

ALTER TABLE "Job" ALTER COLUMN "responsibilities" SET DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Job" ALTER COLUMN "requirements" SET DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Job" ALTER COLUMN "requiredSkills" SET DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Job" ALTER COLUMN "preferredSkills" SET DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Job" ALTER COLUMN "screeningQuestions" SET DEFAULT ARRAY[]::TEXT[];
