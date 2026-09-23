import type { AiProvider } from '../types'
import { geminiProvider } from './gemini'
import { groqProvider } from './groq'
import { mistralProvider } from './mistral'
import { openRouterProvider } from './openrouter'
import { mockProvider } from './mock'

/**
 * Every provider the app knows about.
 *
 * Order here is only the registry; the chain's order comes from
 * `AI_PROVIDER_ORDER` or the router's default. Adding a provider is this list
 * plus one adapter file — no feature ever changes.
 */
export const ALL_PROVIDERS: AiProvider[] = [
  geminiProvider,
  groqProvider,
  mistralProvider,
  openRouterProvider,
  mockProvider,
]

export { geminiProvider, groqProvider, mistralProvider, openRouterProvider, mockProvider }
