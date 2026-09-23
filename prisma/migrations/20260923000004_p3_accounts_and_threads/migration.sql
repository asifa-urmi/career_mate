-- Account suspension, notification preferences, and conversation scoping.

-- Suspension is reversible and destroys nothing. An account that can only be
-- deleted is an account that gets deleted by mistake.
ALTER TABLE "public"."User"
  ADD COLUMN "suspendedAt" TIMESTAMP(3),
  ADD COLUMN "suspendedReason" TEXT;

CREATE INDEX "User_suspendedAt_idx" ON "public"."User"("suspendedAt");

-- Defaults to everything on. An empty array later means they switched it all
-- off, which is a different thing from never having chosen.
ALTER TABLE "public"."User"
  ADD COLUMN "notifyOn" "NotificationType"[]
    NOT NULL
    DEFAULT ARRAY['APPLICATION_UPDATE', 'NEW_MESSAGE', 'JOB_MATCH', 'SYSTEM']::"NotificationType"[];

-- A thread belongs to the application it grew out of, so "may these two people
-- talk" has a concrete answer instead of being a policy question. Unique, so one
-- application cannot sprout two parallel threads.
ALTER TABLE "public"."Conversation"
  ADD COLUMN "applicationId" TEXT;

CREATE UNIQUE INDEX "Conversation_applicationId_key"
  ON "public"."Conversation"("applicationId");
