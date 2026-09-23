import { AiProviderError, type AiProvider, type AiRequest, type AiResponse } from '../types'
import { postJson } from './http'

/**
 * Google Gemini — first in the chain because its free tier is the most generous.
 *
 * Its API differs from the rest: a system instruction is a separate field rather
 * than a message, and JSON mode is a MIME type on the generation config.
 */
const MODEL = 'gemini-2.0-flash'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

export const geminiProvider: AiProvider = {
  id: 'gemini',
  label: 'Google Gemini',

  isConfigured() {
    return Boolean(process.env.GOOGLE_AI_API_KEY)
  },

  async complete(request: AiRequest): Promise<AiResponse> {
    const apiKey = process.env.GOOGLE_AI_API_KEY
    if (!apiKey) throw new AiProviderError('not_configured', 'GOOGLE_AI_API_KEY is not set')

    const system = request.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n')

    const contents = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: 'user', parts: [{ text: m.content }] }))

    const payload = await postJson(
      `${ENDPOINT}?key=${encodeURIComponent(apiKey)}`,
      {
        contents,
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        generationConfig: {
          maxOutputTokens: request.maxTokens ?? 1200,
          temperature: 0.4,
          ...(request.json ? { responseMimeType: 'application/json' } : {}),
        },
      },
      {},
    )

    const data = payload as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
      promptFeedback?: { blockReason?: string }
    }

    if (data.promptFeedback?.blockReason) {
      throw new AiProviderError('refused', `Blocked: ${data.promptFeedback.blockReason}`)
    }

    const candidate = data.candidates?.[0]
    if (candidate?.finishReason === 'SAFETY' || candidate?.finishReason === 'RECITATION') {
      throw new AiProviderError('refused', `Declined: ${candidate.finishReason}`)
    }

    const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
    const response: AiResponse = { text, providerId: 'gemini' }
    if (data.usageMetadata?.promptTokenCount !== undefined) {
      response.promptTokens = data.usageMetadata.promptTokenCount
    }
    if (data.usageMetadata?.candidatesTokenCount !== undefined) {
      response.completionTokens = data.usageMetadata.candidatesTokenCount
    }
    return response
  },
}
