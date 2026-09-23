import { describe, expect, it } from 'vitest'
import { mockProvider } from '@/lib/ai/providers/mock'
import type { AiFeature } from '@/lib/ai/types'

const FEATURES: AiFeature[] = [
  'match-explain',
  'cv-review',
  'cover-letter',
  'interview-questions',
  'coach-chat',
]

function request(feature: AiFeature, json = false) {
  return {
    feature,
    json,
    messages: [
      { role: 'system' as const, content: 'You are helpful.' },
      { role: 'user' as const, content: 'Tell me about this role.' },
    ],
  }
}

describe('mockProvider', () => {
  // The chain's floor. If this could ever be unavailable, the promise that the
  // app still answers when every free tier is dry would not hold.
  it('is always configured, with or without any environment', () => {
    expect(mockProvider.isConfigured()).toBe(true)
  })

  it('answers for every feature the app has', async () => {
    for (const feature of FEATURES) {
      const response = await mockProvider.complete(request(feature))
      expect(response.text.length, feature).toBeGreaterThan(0)
      expect(response.providerId).toBe('mock')
    }
  })

  // Deterministic, so a test that exercises a feature end to end is not
  // comparing against a different answer each run.
  it('gives the same answer for the same request', async () => {
    const a = await mockProvider.complete(request('cv-review'))
    const b = await mockProvider.complete(request('cv-review'))
    expect(a.text).toBe(b.text)
  })

  it('gives different answers for different features', async () => {
    const a = await mockProvider.complete(request('cv-review'))
    const b = await mockProvider.complete(request('interview-questions'))
    expect(a.text).not.toBe(b.text)
  })

  // A structured feature parses the response through a Zod schema. A mock that
  // returned prose would make every such feature fail over to nothing.
  it('returns parseable JSON when the request asks for it', async () => {
    for (const feature of FEATURES) {
      const response = await mockProvider.complete(request(feature, true))
      expect(() => JSON.parse(response.text), `${feature} json`).not.toThrow()
    }
  })

  it('says plainly that it is a fallback rather than imitating a model', async () => {
    const response = await mockProvider.complete(request('coach-chat'))
    expect(response.text.toLowerCase()).toMatch(/unavailable|fallback|not available/)
  })
})
