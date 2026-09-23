# CareerMate P3 — Remainder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans.

**Goal:** The seven remaining placeholder pages become real: messaging both ways, the hiring pipeline board, hiring analytics, admin user management, the safety queue, and account settings.

**Architecture:** Unchanged. Every server action's service re-checks role and ownership, ownership predicate in the `where`.

**Spec:** [`docs/superpowers/specs/2026-09-23-careermate-rebuild-design.md`](../specs/2026-09-23-careermate-rebuild-design.md) §4

## Global Constraints

- Same authorization rule as P0–P2, which two reviews were written around: **the layout guard protects the page, not the action**.
- A conversation is reachable only by a participant. Membership is a `where` predicate, never a check after fetching.
- Messaging is scoped to a real relationship: an employer may only open a thread with a candidate who applied to one of their company's jobs. Cold outreach is not a feature.
- Admin actions that change another account are recorded with the acting admin. An admin who cannot be audited is not an admin.
- No admin action can delete a user's data outright; suspension is reversible.
- New tables — none expected — would need deny-all RLS (`tests/unit/rls-migration.test.ts` enforces it across all migrations).

## Review Focus

1. **A candidate opening a conversation id belonging to two other people.** Expected: 404, no messages, no membership created. → Task 1.
2. **An employer messaging a candidate who never applied to their company.** Expected: refused; no conversation created. → Task 1.
3. **An admin demoting themselves, or the last admin demoting themselves.** Expected: refused, so the platform cannot be locked out of its own moderation. → Task 4.
4. **A report filed against a job that is later deleted.** Expected: the queue still renders, showing the target is gone rather than crashing. → Task 5.
5. **A settings change to an email that already belongs to another account.** Expected: a readable conflict, nothing written, session intact. → Task 6.

---

## Task 1: Messaging

**Files:** `src/lib/db/repositories/message.repository.ts`, `src/server/services/message.service.ts`, `src/app/(candidate)/messages/{page,actions}.tsx`, `src/app/(employer)/employer/messages/page.tsx`, `src/components/messages/*`; Test `tests/services/message.service.test.ts`

**Produces:** `startConversation(user, { applicationId })`, `sendMessage(user, { conversationId, body })`, `markConversationRead(user, conversationId)`, `listConversations(userId)`, `findConversation(userId, conversationId)`.

- [ ] Failing tests — **Review Focus 1 and 2**: a non-participant gets null; an employer cannot start a thread without an application to their own company's job; sending writes a notification for the other participant in the same transaction; an empty body is rejected; a 5000-char cap.
- [ ] RED → implement → GREEN → build both pages → commit.

---

## Task 2: Hiring pipeline

**Files:** `src/app/(employer)/pipeline/page.tsx`, `src/components/employer/pipeline-board.tsx`

**Produces:** `pipelineForCompany(companyId, jobId?)` — applications grouped by stage.

- [ ] Build the five-column board reusing `changeStageAction` from P1, so one stage-change path exists.
- [ ] Verify, commit.

---

## Task 3: Hiring analytics

**Files:** `src/lib/db/repositories/analytics.repository.ts`, `src/app/(employer)/analytics/page.tsx`; Test `tests/unit/analytics.test.ts`

**Produces:** `funnelFor(companyId)`, `applicationsOverTime(companyId, days)`, `timeToFirstResponse(companyId)`, plus pure helpers for bucketing and averaging.

- [ ] Failing tests for the pure helpers: an empty dataset yields zeroes not NaN; a funnel where nobody progressed; averages ignore applications never moved.
- [ ] RED → implement → GREEN → build the page with `BarChart` → commit.

---

## Task 4: Admin user management

**Files:** `src/server/services/admin.service.ts`, `src/app/(admin)/admin/users/{page,actions}.tsx`, `src/components/admin/user-row.tsx`; Test `tests/services/admin.service.test.ts`

**Produces:** `listUsers(filter)`, `changeUserRole(admin, userId, role)`, `setUserSuspended(admin, userId, suspended)`.

- [ ] Failing tests — **Review Focus 3**: an admin cannot demote themselves; the last admin cannot be demoted or suspended; a non-admin is refused; every change writes a notification to the affected user.
- [ ] Requires a `suspendedAt` column and a migration; suspension must block sign-in.
- [ ] RED → implement → GREEN → build → commit.

---

## Task 5: Reports and the safety queue

**Files:** `src/server/services/report.service.ts`, `src/app/(admin)/admin/reports/{page,actions}.tsx`, `src/components/report/report-button.tsx`; Test `tests/services/report.service.test.ts`

**Produces:** `fileReport(user, { targetType, targetId, reason, detail })`, `resolveReport(admin, reportId, status, note)`, `listReports(status?)`.

- [ ] Failing tests — **Review Focus 4**: a report whose target no longer exists still lists; a duplicate report from the same person is a no-op; only an admin resolves; the reporter is notified of the outcome.
- [ ] RED → implement → GREEN → build, and put a report control on job detail → commit.

---

## Task 6: Settings

**Files:** `src/server/services/account.service.ts`, `src/app/(shared)/settings/{page,actions}.tsx`, `src/components/settings/*`; Test `tests/services/account.service.test.ts`

**Produces:** `changeEmail`, `changePassword`, `updateNotificationPreferences`, `exportMyData`, `deleteMyAccount`.

- [ ] Failing tests — **Review Focus 5**: a taken email is a readable CONFLICT with nothing written; a password change requires the current one; export returns only the caller's own data; deletion requires typed confirmation and cascades.
- [ ] RED → implement → GREEN → build → commit.

---

## Task 7: Close out

- [ ] Every placeholder replaced; `tests/unit/routes-exist.test.ts` extended to cover the new routes.
- [ ] README phase table; full verification; commit.
