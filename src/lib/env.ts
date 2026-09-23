import 'server-only'

import { z } from 'zod'

/**
 * Environment contract.
 *
 * Parsing happens lazily, on first access, rather than at module load: a missing
 * variable then fails with the variable's name at the point of use instead of
 * breaking every import in the process, and tests can exercise the schema
 * without a configured environment.
 *
 * Every AI provider key is optional on purpose. The provider chain treats "key
 * present" as "provider available", so the deployment adapts to whichever free
 * tiers the operator has signed up for without a code change.
 */
export const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'Supabase pooled connection string is required'),
  DIRECT_URL: z.string().min(1, 'Supabase direct connection string is required'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('Must be your Supabase project URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Supabase service role key is required'),

  GOOGLE_AI_API_KEY: z.string().min(1).optional(),
  GROQ_API_KEY: z.string().min(1).optional(),
  MISTRAL_API_KEY: z.string().min(1).optional(),
  OPENROUTER_API_KEY: z.string().min(1).optional(),

  /** Comma-separated provider ids, highest priority first. */
  AI_PROVIDER_ORDER: z.string().min(1).optional(),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

export const publicEnvSchema = serverEnvSchema.pick({
  NEXT_PUBLIC_SUPABASE_URL: true,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: true,
})

export type PublicEnv = z.infer<typeof publicEnvSchema>

let cachedServerEnv: ServerEnv | null = null

export function serverEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv

  const parsed = serverEnvSchema.safeParse(process.env)
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`)
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`)
  }

  cachedServerEnv = parsed.data
  return cachedServerEnv
}

/**
 * Readable in the browser. Next inlines `NEXT_PUBLIC_*` at build time, so these
 * must be referenced as literal property accesses rather than looked up
 * dynamically.
 */
export function publicEnv(): PublicEnv {
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })
  if (!parsed.success) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Both must be set at build time.',
    )
  }
  return parsed.data
}
