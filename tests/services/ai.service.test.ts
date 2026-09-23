import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionUser } from '@/lib/auth/session'
import { RATE_LIMITS } from '@/lib/ai/rate-limit'

const createInteraction = vi.fn()
const countInteractions = vi.fn()
const complete = vi.fn()

vi.mock('@/lib/db/prisma', () => ({
  prisma: { aiInteraction: { create: createInteraction, count: countInteractions } },
}))
vi.mock('@/lib/ai/router', () => ({ completeWithFailover: complete }))

const { askCoach, draftCoverLetter, explainMatch, interviewQuestions, reviewCv } = await import(
  '@/server/services/ai.service'
)

function user(role: SessionUser['role'] = 'CANDIDATE'): SessionUser {
  return {
    id: 'uid-1',
    email: 'a@b.com',
    name: 'Rafat',
    role,
    onboardedAt: new Date(),
    onboarded: true,
  }
}

const candidate = {
  name: 'Rafat',
  headline: 'Accounts Officer',
  location: 'Dhaka',
  bio: null,
  experienceLevel: 'ONE_TO_THREE' as const,
  skills: ['Excel', 'Accounting'],
  experiences: [],
  educations: [],
  cvText: 'Accounts Officer with three years at Meridian Group.',
  primarySector: 'FINANCE' as const,
  preference: null,
}

const job = {
  title: 'Accounts Officer',
  company: 'Meridian Group',
  sectorLabel: 'Finance',
  category: 'FINANCE' as const,
  location: 'Dhaka',
  workMode: 'ONSITE' as const,
  jobType: 'FULL_TIME' as const,
  salary: '৳38k–55k',
  summary: 'Maintain accounts and support month-end closing.',
  responsibilities: ['Record daily transactions'],
  requirements: ['BBA in Accounting'],
  requiredSkills: ['Excel'],
  preferredSkills: [],
  salaryMinBdt: 38000,
  salaryMaxBdt: 55000,
}

function answered(json: unknown, providerId = 'gemini', usedFallback = false) {
  return {
    response: { text: JSON.stringify(json), providerId, promptTokens: 100, completionTokens: 50 },
    attempts: [],
    usedFallback,
  }
}

beforeEach(() => {
  createInteraction.mockReset()
  countInteractions.mockReset()
  complete.mockReset()
  createInteraction.mockResolvedValue({ id: 'ai-1' })
  countInteractions.mockResolvedValue(0)
  complete.mockResolvedValue(
    answered({ summary: 'A strong fit.', strengths: ['Excel'], gaps: [] }),
  )
})

describe('role gating', () => {
  it('refuses an employer on every feature', async () => {
    for (const result of [
      await explainMatch(user('EMPLOYER'), candidate, job),
      await reviewCv(user('EMPLOYER'), candidate, null),
      await draftCoverLetter(user('EMPLOYER'), candidate, job),
      await interviewQuestions(user('EMPLOYER'), candidate, job),
      await askCoach(user('EMPLOYER'), candidate, 'What next?'),
    ]) {
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('FORBIDDEN')
    }
    expect(complete).not.toHaveBeenCalled()
  })
})

describe('explainMatch', () => {
  it('returns the parsed explanation and which provider served it', async () => {
    const result = await explainMatch(user(), candidate, job)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.data.summary).toBe('A strong fit.')
      expect(result.value.providerId).toBe('gemini')
      expect(result.value.providerLabel).toBe('Google Gemini')
      expect(result.value.usedFallback).toBe(false)
    }
  })

  it('asks for JSON, so the router can reject prose and fail over', async () => {
    await explainMatch(user(), candidate, job)
    expect(complete.mock.calls[0]?.[0]?.json).toBe(true)
  })

  // The score is CareerMate's, not the model's. The prompt hands it over so the
  // model narrates it rather than inventing a different number.
  it('gives the model the calculated score and its per-dimension evidence', async () => {
    await explainMatch(user(), candidate, job)

    const prompt = JSON.stringify(complete.mock.calls[0]?.[0]?.messages ?? [])
    expect(prompt).toContain('Overall match:')
    expect(prompt).toMatch(/do not recalculate it/i)
  })

  it('carries the guardrail against inventing qualifications', async () => {
    await explainMatch(user(), candidate, job)

    const prompt = JSON.stringify(complete.mock.calls[0]?.[0]?.messages ?? [])
    expect(prompt).toMatch(/never invent experience/i)
  })

  it('passes the candidate own facts rather than a generic profile', async () => {
    await explainMatch(user(), candidate, job)

    const prompt = JSON.stringify(complete.mock.calls[0]?.[0]?.messages ?? [])
    expect(prompt).toContain('Accounts Officer')
    expect(prompt).toContain('Excel')
  })

  it('reports the fallback as a fallback rather than as model output', async () => {
    complete.mockResolvedValue(
      answered({ unavailable: true, summary: 'Unavailable', strengths: [], gaps: [] }, 'mock', true),
    )

    const result = await explainMatch(user(), candidate, job)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.usedFallback).toBe(true)
      expect(result.value.providerLabel).toBe('Offline fallback')
    }
  })

  // Valid JSON of the wrong shape. The router already failed over on
  // unparseable output; this is the second gate.
  it('reports valid JSON of the wrong shape rather than rendering it', async () => {
    complete.mockResolvedValue(answered({ totally: 'different' }))

    const result = await explainMatch(user(), candidate, job)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('PROVIDER_UNAVAILABLE')
  })
})

describe('the interaction log', () => {
  it('records which provider served the request and how long it took', async () => {
    await explainMatch(user(), candidate, job)

    const data = createInteraction.mock.calls[0]?.[0]?.data
    expect(data).toMatchObject({ userId: 'uid-1', feature: 'match-explain', providerId: 'gemini' })
    expect(typeof data?.latencyMs).toBe('number')
  })

  it('records the providers that failed first, so failover is auditable', async () => {
    complete.mockResolvedValue({
      ...answered({ summary: 'ok', strengths: [], gaps: [] }, 'groq'),
      attempts: [
        { providerId: 'gemini', reason: 'quota', message: 'out', retryable: true },
      ],
    })

    await explainMatch(user(), candidate, job)

    expect(createInteraction.mock.calls[0]?.[0]?.data?.attempts).toHaveLength(1)
  })

  it('logs even when the response fails validation', async () => {
    complete.mockResolvedValue(answered({ wrong: 'shape' }))

    await explainMatch(user(), candidate, job)

    expect(createInteraction).toHaveBeenCalled()
  })

  // Observability must never take down the thing it observes.
  it('still answers when the log write fails', async () => {
    createInteraction.mockRejectedValue(new Error('db down'))

    const result = await explainMatch(user(), candidate, job)

    expect(result.ok).toBe(true)
  })
})

describe('reviewCv', () => {
  it('reviews a CV with extracted text', async () => {
    complete.mockResolvedValue(answered({ summary: 'Solid.', suggestions: [] }))

    const result = await reviewCv(user(), candidate, 'Accounts Officer')

    expect(result.ok).toBe(true)
  })

  // A scanned PDF has no text layer. Sending an empty CV to a model produces
  // confident advice about a document nobody read.
  it('refuses when no text could be extracted, rather than reviewing nothing', async () => {
    const result = await reviewCv(user(), { ...candidate, cvText: '   ' }, null)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
    expect(complete).not.toHaveBeenCalled()
  })
})

describe('askCoach', () => {
  beforeEach(() => {
    complete.mockResolvedValue(answered({ reply: 'Start with your CV.' }))
  })

  it('answers a question', async () => {
    const result = await askCoach(user(), candidate, 'Where should I start?')

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.data.reply).toBe('Start with your CV.')
  })

  it('refuses an empty question', async () => {
    const result = await askCoach(user(), candidate, '   ')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION')
    expect(complete).not.toHaveBeenCalled()
  })

  it('refuses a question long enough to be an attempt at something else', async () => {
    const result = await askCoach(user(), candidate, 'x'.repeat(2001))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION')
    expect(complete).not.toHaveBeenCalled()
  })
})

describe('interviewQuestions and draftCoverLetter', () => {
  it('parse their own shapes', async () => {
    complete.mockResolvedValue(
      answered({ questions: [{ question: 'Q', whatTheyAreLookingFor: 'A' }] }),
    )
    const questions = await interviewQuestions(user(), candidate, job)
    expect(questions.ok).toBe(true)

    complete.mockResolvedValue(answered({ draft: 'Dear hiring team,' }))
    const letter = await draftCoverLetter(user(), candidate, job)
    expect(letter.ok).toBe(true)
    if (letter.ok) expect(letter.value.data.draft).toContain('Dear')
  })

  it('tells the cover-letter model to leave out anything the profile does not support', async () => {
    complete.mockResolvedValue(answered({ draft: 'x' }))

    await draftCoverLetter(user(), candidate, job)

    const prompt = JSON.stringify(complete.mock.calls[0]?.[0]?.messages ?? [])
    expect(prompt).toMatch(/leave it out/i)
  })
})

/**
 * One account must not be able to spend the whole platform's allowance.
 *
 * The provider keys are a single free tier shared by everyone. The cooldowns
 * react to a provider that has already refused — they do not stop one account
 * from getting it there. A signed-in candidate looping one action a few hundred
 * times exhausted Gemini, then Groq, then Mistral, then OpenRouter, and every
 * other user saw the offline fallback for the next quarter of an hour.
 */
describe('the per-user rate limit', () => {
  it('lets an ordinary request through', async () => {
    const result = await reviewCv(user(), candidate, null)

    expect(result.ok).toBe(true)
    expect(complete).toHaveBeenCalled()
  })

  it('refuses once the hour is used up, without calling a provider', async () => {
    countInteractions.mockResolvedValue(RATE_LIMITS['cv-review'])

    const result = await reviewCv(user(), candidate, null)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('RATE_LIMITED')
    expect(complete).not.toHaveBeenCalled()
  })

  it('tells the person what the limit was', async () => {
    countInteractions.mockResolvedValue(RATE_LIMITS['cv-review'])

    const result = await reviewCv(user(), candidate, null)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toContain(String(RATE_LIMITS['cv-review']))
  })

  it('counts this user only, and only this feature, over the last hour', async () => {
    await reviewCv(user(), candidate, null)

    const where = countInteractions.mock.calls[0]?.[0]?.where
    expect(where).toMatchObject({ userId: 'uid-1', feature: 'cv-review' })
    expect(where?.createdAt?.gte).toBeInstanceOf(Date)
  })

  // Otherwise running out of cover letters would also cost you interview prep.
  it('rations each feature separately', async () => {
    countInteractions.mockResolvedValue(RATE_LIMITS['cover-letter'])

    const blocked = await draftCoverLetter(user(), candidate, job)
    expect(blocked.ok).toBe(false)

    countInteractions.mockResolvedValue(0)
    const allowed = await interviewQuestions(user(), candidate, job)
    expect(allowed.ok).toBe(true)
  })

  // A counting query that fails must not take the feature down with it.
  it('lets the request through when the count itself fails', async () => {
    countInteractions.mockRejectedValue(new Error('db down'))

    const result = await reviewCv(user(), candidate, null)

    expect(result.ok).toBe(true)
  })
})
