-- Deleting an employer must not be refused by the jobs they posted.
--
-- Job.postedById was a required relation with no onDelete, which Prisma emits
-- as ON DELETE RESTRICT. Any employer who had ever posted a role therefore hit
-- a foreign-key violation on account deletion, surfaced as "please try again",
-- with no way to ever succeed.
--
-- A listing belongs to the company, which survives; the person who typed it in
-- may not. So the column becomes nullable and the constraint sets it null.

ALTER TABLE "Job" ALTER COLUMN "postedById" DROP NOT NULL;

ALTER TABLE "Job" DROP CONSTRAINT "Job_postedById_fkey";

ALTER TABLE "Job"
  ADD CONSTRAINT "Job_postedById_fkey"
  FOREIGN KEY ("postedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
