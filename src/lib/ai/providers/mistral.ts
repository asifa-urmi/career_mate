import { AiProviderError, type AiProvider, type AiRequest, type AiResponse } from '../types'
import { openAiStyleComplete } from './http'

export const mistralProvider: AiProvider = {
  id: 'mistral',
  label: 'Mistral',

  isConfigured() {
    return Boolean(process.env.MISTRAL_API_KEY)
  },

  async complete(request: AiRequest): Promise<AiResponse> {
    const apiKey = process.env.MISTRAL_API_KEY
    if (!apiKey) throw new AiProviderError('not_configured', 'MISTRAL_API_KEY is not set')

    return openAiStyleComplete({
      url: 'https://api.mistral.ai/v1/chat/completions',
      apiKey,
      model: 'mistral-small-latest',
      providerId: 'mistral',
      request,
    })
  },
}
