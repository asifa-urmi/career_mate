import { AiProviderError, type AiProvider, type AiRequest, type AiResponse } from '../types'
import { openAiStyleComplete } from './http'

/**
 * OpenRouter — last real provider, because it is the broadest safety net: one
 * key reaches many models, including free ones. The referer and title headers
 * are what OpenRouter uses to attribute traffic.
 */
export const openRouterProvider: AiProvider = {
  id: 'openrouter',
  label: 'OpenRouter',

  isConfigured() {
    return Boolean(process.env.OPENROUTER_API_KEY)
  },

  async complete(request: AiRequest): Promise<AiResponse> {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) throw new AiProviderError('not_configured', 'OPENROUTER_API_KEY is not set')

    return openAiStyleComplete({
      url: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey,
      model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
      providerId: 'openrouter',
      request,
      extraHeaders: {
        'http-referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://careermate.local',
        'x-title': 'CareerMate',
      },
    })
  },
}
