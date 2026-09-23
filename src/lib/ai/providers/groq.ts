import { AiProviderError, type AiProvider, type AiRequest, type AiResponse } from '../types'
import { openAiStyleComplete } from './http'

/**
 * Groq — second in the chain. Its free tier is smaller than Gemini's but it is
 * by far the fastest, which makes it a good catch when Gemini's daily quota
 * runs out mid-afternoon.
 */
export const groqProvider: AiProvider = {
  id: 'groq',
  label: 'Groq',

  isConfigured() {
    return Boolean(process.env.GROQ_API_KEY)
  },

  async complete(request: AiRequest): Promise<AiResponse> {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) throw new AiProviderError('not_configured', 'GROQ_API_KEY is not set')

    return openAiStyleComplete({
      url: 'https://api.groq.com/openai/v1/chat/completions',
      apiKey,
      model: 'llama-3.3-70b-versatile',
      providerId: 'groq',
      request,
    })
  },
}
