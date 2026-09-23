import { AiProviderError, type AiRequest, type AiResponse } from '../types'

/**
 * The shared HTTP shape.
 *
 * Every adapter here is a plain `fetch` rather than a vendor SDK. Four SDKs
 * would be four dependency trees, four release cadences and four ways of
 * reporting a 429, for four requests whose bodies differ by a handful of field
 * names. The timeout matters more than any of that: a provider that hangs must
 * not hold up the chain behind it.
 */

export const AI_TIMEOUT_MS = 20_000

export async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string>,
): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      // Status first: it is the one signal every provider reports the same way.
      throw Object.assign(new Error(text.slice(0, 500) || response.statusText), {
        status: response.status,
      })
    }

    return await response.json()
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AiProviderError('timeout', `No response within ${AI_TIMEOUT_MS / 1000}s`)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

/** Most providers speak the OpenAI chat-completions shape. */
export async function openAiStyleComplete(options: {
  url: string
  apiKey: string
  model: string
  providerId: string
  request: AiRequest
  extraHeaders?: Record<string, string>
}): Promise<AiResponse> {
  const { url, apiKey, model, providerId, request, extraHeaders } = options

  const payload = await postJson(
    url,
    {
      model,
      messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: request.maxTokens ?? 1200,
      temperature: 0.4,
      ...(request.json ? { response_format: { type: 'json_object' } } : {}),
    },
    { authorization: `Bearer ${apiKey}`, ...extraHeaders },
  )

  const data = payload as {
    choices?: { message?: { content?: string }; finish_reason?: string }[]
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }

  const choice = data.choices?.[0]
  if (choice?.finish_reason === 'content_filter') {
    throw new AiProviderError('refused', 'The provider declined to answer this request')
  }

  const text = choice?.message?.content ?? ''
  const response: AiResponse = { text, providerId }
  if (data.usage?.prompt_tokens !== undefined) response.promptTokens = data.usage.prompt_tokens
  if (data.usage?.completion_tokens !== undefined) {
    response.completionTokens = data.usage.completion_tokens
  }
  return response
}
