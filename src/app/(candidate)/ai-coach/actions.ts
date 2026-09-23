'use server'

import { requireUser } from '@/lib/auth/guards'
import { candidateProfileIdFor } from '@/lib/db/repositories/saved-job.repository'
import { candidateFacts, jobFacts } from '@/lib/ai/facts'
import {
  askCoach,
  draftCoverLetter,
  explainMatch,
  interviewQuestions,
} from '@/server/services/ai.service'
import type {
  CoachReply,
  CoverLetter,
  InterviewQuestions,
  MatchExplanation,
} from '@/lib/ai/schemas'

export type AiPanelState<T> = {
  data?: T
  providerLabel?: string
  usedFallback?: boolean
  error?: string
}

/** Every action below loads the caller's own facts by their own profile id. */
async function factsForCaller() {
  const user = await requireUser()
  const profileId = await candidateProfileIdFor(user.id)
  if (!profileId) return { user, facts: null }
  return { user, facts: await candidateFacts(profileId) }
}

export async function askCoachAction(question: string): Promise<AiPanelState<CoachReply>> {
  const { user, facts } = await factsForCaller()
  if (!facts) return { error: 'Finish setting up your profile first.' }

  const result = await askCoach(user, facts, question)
  if (!result.ok) return { error: result.error.message }

  return {
    data: result.value.data,
    providerLabel: result.value.providerLabel,
    usedFallback: result.value.usedFallback,
  }
}

export async function explainMatchAction(
  jobId: string,
): Promise<AiPanelState<MatchExplanation>> {
  const { user, facts } = await factsForCaller()
  if (!facts) return { error: 'Finish setting up your profile first.' }

  const job = await jobFacts(jobId)
  if (!job) return { error: 'That role is no longer available.' }

  const result = await explainMatch(user, facts, job)
  if (!result.ok) return { error: result.error.message }

  return {
    data: result.value.data,
    providerLabel: result.value.providerLabel,
    usedFallback: result.value.usedFallback,
  }
}

export async function coverLetterAction(jobId: string): Promise<AiPanelState<CoverLetter>> {
  const { user, facts } = await factsForCaller()
  if (!facts) return { error: 'Finish setting up your profile first.' }

  const job = await jobFacts(jobId)
  if (!job) return { error: 'That role is no longer available.' }

  const result = await draftCoverLetter(user, facts, job)
  if (!result.ok) return { error: result.error.message }

  return {
    data: result.value.data,
    providerLabel: result.value.providerLabel,
    usedFallback: result.value.usedFallback,
  }
}

export async function interviewPrepAction(
  jobId: string,
): Promise<AiPanelState<InterviewQuestions>> {
  const { user, facts } = await factsForCaller()
  if (!facts) return { error: 'Finish setting up your profile first.' }

  const job = await jobFacts(jobId)
  if (!job) return { error: 'That role is no longer available.' }

  const result = await interviewQuestions(user, facts, job)
  if (!result.ok) return { error: result.error.message }

  return {
    data: result.value.data,
    providerLabel: result.value.providerLabel,
    usedFallback: result.value.usedFallback,
  }
}
