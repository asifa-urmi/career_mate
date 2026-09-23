import 'server-only'

import type { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { appError } from '@/lib/utils/errors'
import { err, ok, type Result } from '@/lib/utils/result'
import type { SessionUser } from '@/lib/auth/session'
import { completeWithFailover } from '@/lib/ai/router'
import { fallbackReason } from '@/lib/ai/providers/mock'
import type { AiFeature, AiMessage } from '@/lib/ai/types'
import { rateLimitMessage, windowStart, withinLimit } from '@/lib/ai/rate-limit'
import {
  coachReplySchema,
  coverLetterSchema,
  cvReviewSchema,
  interviewQuestionsSchema,
  matchExplanationSchema,
} from '@/lib/ai/schemas'
import {
  coachPrompt,
  coverLetterPrompt,
  cvReviewPrompt,
  interviewPrompt,
  matchExplanationPrompt,
  type CandidateFacts,
  type JobFacts,
} from '@/lib/ai/prompts'
import { scoreMatch, type MatchCandidate, type MatchJob } from '@/lib/matching/score'

/** What every AI feature returns: the answer, plus how it was obtained. */
export type AiResult<T> = {
  data: T
  providerId: string
  providerLabel: string
  usedFallback: boolean
  /** Only meaningful when `usedFallback`: which problem it was. */
  fallbackReason?: 'unconfigured' | 'exhausted'
}

const PROVIDER_LABELS: Record<string, string> = {
  gemini: 'Google Gemini',
  groq: 'Groq',
  mistral: 'Mistral',
  openrouter: 'OpenRouter',
  mock: 'Offline fallback',
}

/**
 * Runs one AI request end to end: failover, schema validation, and the log.
 *
 * The interaction log is what makes the chain observable. Without it, "the AI is
 * slow today" or "why does it keep saying it is unavailable" are unanswerable —
 * with it, the provider that served each request and the ones that failed first
 * are on the record.
 */
async function run<T extends z.ZodType>(
  user: SessionUser | null,
  feature: AiFeature,
  messages: AiMessage[],
  schema: T,
): Promise<Result<AiResult<z.infer<T>>>> {
  // Before a provider is touched, because the point is to stop this account from
  // exhausting an allowance the whole platform shares.
  const refusal = await rateLimitRefusal(user, feature)
  if (refusal) return err(refusal.error)

  const startedAt = Date.now()

  const outcome = await completeWithFailover({ feature, messages, json: true })
  const latencyMs = Date.now() - startedAt

  const parsed = schema.safeParse(safeJson(outcome.response.text))

  // The router already rejects unparseable JSON and fails over. Reaching here
  // means valid JSON of the wrong shape, which no further provider would fix
  // reliably — so it is reported rather than retried into a loop.
  if (!parsed.success) {
    await logInteraction(user, feature, outcome, latencyMs)
    return err(
      appError(
        'PROVIDER_UNAVAILABLE',
        'The assistant returned something we could not read. Please try again.',
      ),
    )
  }

  await logInteraction(user, feature, outcome, latencyMs)

  return ok({
    data: parsed.data,
    providerId: outcome.response.providerId,
    providerLabel: PROVIDER_LABELS[outcome.response.providerId] ?? outcome.response.providerId,
    usedFallback: outcome.usedFallback,
    ...(outcome.usedFallback ? { fallbackReason: fallbackReason() } : {}),
  })
}

/**
 * Whether this account has used up its hour for this feature.
 *
 * Counted against the interaction log, which is written for every request and so
 * is the record that already exists — no extra table, no in-memory counter that
 * a second serverless instance would not see.
 *
 * A failure of the count itself lets the request through. This limit protects a
 * shared allowance; it is not an authorization check, and taking the feature down
 * because a counting query failed would be the worse outcome.
 */
async function rateLimitRefusal(
  user: SessionUser | null,
  feature: AiFeature,
): Promise<{ error: ReturnType<typeof appError> } | null> {
  if (!user) return null

  try {
    const used = await prisma.aiInteraction.count({
      where: { userId: user.id, feature, createdAt: { gte: windowStart(new Date()) } },
    })

    if (!withinLimit(feature, used)) {
      return { error: appError('RATE_LIMITED', rateLimitMessage(feature)) }
    }
  } catch {
    // See above: fail open.
  }

  return null
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function logInteraction(
  user: SessionUser | null,
  feature: AiFeature,
  outcome: Awaited<ReturnType<typeof completeWithFailover>>,
  latencyMs: number,
): Promise<void> {
  try {
    await prisma.aiInteraction.create({
      data: {
        userId: user?.id ?? null,
        feature,
        providerId: outcome.response.providerId,
        attempts: outcome.attempts,
        promptTokens: outcome.response.promptTokens ?? null,
        completionTokens: outcome.response.completionTokens ?? null,
        latencyMs,
      },
    })
  } catch {
    // Observability must never take down the feature it observes.
  }
}

function requireCandidate(user: SessionUser): Result<void> {
  if (user.role !== 'CANDIDATE') {
    return err(appError('FORBIDDEN', 'The career assistant is for job seeker accounts.'))
  }
  return ok(undefined)
}

export async function explainMatch(
  user: SessionUser,
  candidate: CandidateFacts & MatchCandidate,
  job: JobFacts & MatchJob,
) {
  const allowed = requireCandidate(user)
  if (!allowed.ok) return allowed

  const match = scoreMatch(candidate, job)
  return run(user, 'match-explain', matchExplanationPrompt(candidate, job, match), matchExplanationSchema)
}

export async function reviewCv(
  user: SessionUser,
  candidate: CandidateFacts,
  targetRole: string | null,
) {
  const allowed = requireCandidate(user)
  if (!allowed.ok) return allowed

  if (!candidate.cvText?.trim()) {
    return err(
      appError(
        'NOT_FOUND',
        'We could not read any text from that CV — a scanned PDF has no text layer to review.',
      ),
    )
  }

  return run(user, 'cv-review', cvReviewPrompt(candidate, targetRole), cvReviewSchema)
}

export async function draftCoverLetter(
  user: SessionUser,
  candidate: CandidateFacts,
  job: JobFacts,
) {
  const allowed = requireCandidate(user)
  if (!allowed.ok) return allowed

  return run(user, 'cover-letter', coverLetterPrompt(candidate, job), coverLetterSchema)
}

export async function interviewQuestions(
  user: SessionUser,
  candidate: CandidateFacts,
  job: JobFacts,
) {
  const allowed = requireCandidate(user)
  if (!allowed.ok) return allowed

  return run(user, 'interview-questions', interviewPrompt(candidate, job), interviewQuestionsSchema)
}

export async function askCoach(user: SessionUser, candidate: CandidateFacts, question: string) {
  const allowed = requireCandidate(user)
  if (!allowed.ok) return allowed

  const trimmed = question.trim()
  if (!trimmed) return err(appError('VALIDATION', 'Ask a question first.'))
  if (trimmed.length > 2000) {
    return err(appError('VALIDATION', 'Keep your question under 2000 characters.'))
  }

  return run(user, 'coach-chat', coachPrompt(candidate, trimmed), coachReplySchema)
}
