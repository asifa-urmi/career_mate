-- One row per administrator action against another account.
--
-- An admin who cannot be audited is not an admin. Before this, a role change or
-- a suspension left only the resulting state and a notification saying "a
-- platform administrator" — no query could answer which one, or when.

CREATE TYPE "AdminActionType" AS ENUM ('ROLE_CHANGED', 'SUSPENDED', 'RESTORED');

CREATE TABLE "AdminAction" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "targetUserId" TEXT,
    "action" "AdminActionType" NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminAction_createdAt_idx" ON "AdminAction"("createdAt");
CREATE INDEX "AdminAction_targetUserId_createdAt_idx" ON "AdminAction"("targetUserId", "createdAt");

-- Set null rather than cascade: an admin deleting their own account must not
-- erase the record of what they did. actorName is kept for exactly that case.
ALTER TABLE "AdminAction"
  ADD CONSTRAINT "AdminAction_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AdminAction"
  ADD CONSTRAINT "AdminAction_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Deny-all, like every other table: all access goes through the service layer
-- on the Prisma connection. See 20260923000001_rls_deny_all.
ALTER TABLE "public"."AdminAction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AdminAction" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."AdminAction" FROM anon, authenticated;
