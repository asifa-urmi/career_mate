import { beforeEach, describe, expect, it, vi } from 'vitest'

const signUpMock = vi.fn()
const signInMock = vi.fn()
const createUserWithRole = vi.fn()
const findUserById = vi.fn()

const signOutMock = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: async () => ({
    auth: { signUp: signUpMock, signInWithPassword: signInMock, signOut: signOutMock },
  }),
}))
vi.mock('@/lib/db/repositories/user.repository', () => ({ createUserWithRole, findUserById }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { signUp, signIn } = await import('@/server/services/auth.service')

/**
 * Supabase sends the confirmation link to the project's Site URL unless the
 * signup says otherwise. In a fresh project that is localhost, so a deployed
 * site emailed every new user a link to a machine they do not have.
 */
describe('the confirmation link', () => {
  beforeEach(() => {
    signUpMock.mockReset()
    createUserWithRole.mockReset()
    signUpMock.mockResolvedValue({ data: { user: { id: 'uid-1' }, session: null }, error: null })
    createUserWithRole.mockResolvedValue({ id: 'uid-1', role: 'CANDIDATE', onboardedAt: null })
  })

  it('is sent to the callback route on the site the person signed up from', async () => {
    await signUp({ ...input, origin: 'https://career-mate.vercel.app' })

    expect(signUpMock.mock.calls[0]?.[0]?.options?.emailRedirectTo).toBe(
      'https://career-mate.vercel.app/auth/callback',
    )
  })

  it('carries the name and role through as before', async () => {
    await signUp({ ...input, origin: 'https://career-mate.vercel.app' })

    expect(signUpMock.mock.calls[0]?.[0]?.options?.data).toEqual({
      name: 'Rafat',
      role: 'CANDIDATE',
    })
  })

  // Without an origin there is nothing honest to put in the link, and a guessed
  // one emails people at the wrong site. Supabase's Site URL is the better
  // fallback, and omitting the option is how you ask for it.
  it('omits the option rather than guessing when no origin is known', async () => {
    await signUp(input)

    expect(signUpMock.mock.calls[0]?.[0]?.options?.emailRedirectTo).toBeUndefined()
  })
})

const input = {
  name: 'Rafat',
  email: 'a@b.com',
  password: 'longenough1',
  role: 'CANDIDATE',
} as const

describe('signUp', () => {
  beforeEach(() => {
    signUpMock.mockReset()
    createUserWithRole.mockReset()
    findUserById.mockReset()
  })

  // Review Focus 2
  it('returns CONFLICT with a readable message for an already-registered email', async () => {
    signUpMock.mockResolvedValue({
      data: { user: null },
      error: { message: 'User already registered', status: 422, code: 'user_already_exists' },
    })

    const result = await signUp(input)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('CONFLICT')
      expect(result.error.message).toMatch(/already registered/i)
    }
    expect(createUserWithRole).not.toHaveBeenCalled()
  })

  it('creates the User row with the requested role on success', async () => {
    signUpMock.mockResolvedValue({ data: { user: { id: 'uid-9' } }, error: null })
    createUserWithRole.mockResolvedValue({ id: 'uid-9', role: 'EMPLOYER' })

    const result = await signUp({ ...input, email: 'b@c.com', role: 'EMPLOYER' })

    expect(result.ok).toBe(true)
    expect(createUserWithRole).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'uid-9', email: 'b@c.com', role: 'EMPLOYER' }),
    )
  })

  it('does not create a User row when Supabase returns no user', async () => {
    signUpMock.mockResolvedValue({ data: { user: null }, error: null })

    const result = await signUp(input)

    expect(result.ok).toBe(false)
    expect(createUserWithRole).not.toHaveBeenCalled()
  })

  // The auth user exists at this point; leaving it without a User row is exactly
  // the half-built state getCurrentUser() treats as unauthenticated, so the person
  // must be told to try again rather than shown a success screen.
  it('reports failure when the profile row cannot be written', async () => {
    signUpMock.mockResolvedValue({ data: { user: { id: 'uid-9' } }, error: null })
    createUserWithRole.mockRejectedValue(new Error('unique constraint'))

    const result = await signUp(input)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INTERNAL')
  })

  it('is idempotent when the profile row already exists from a retried signup', async () => {
    signUpMock.mockResolvedValue({ data: { user: { id: 'uid-9' } }, error: null })
    findUserById.mockResolvedValue({ id: 'uid-9', role: 'CANDIDATE' })

    const result = await signUp(input)

    expect(result.ok).toBe(true)
    expect(createUserWithRole).not.toHaveBeenCalled()
  })

  it('surfaces a weak-password rejection from Supabase as a field error', async () => {
    signUpMock.mockResolvedValue({
      data: { user: null },
      error: { message: 'Password should be at least 6 characters', code: 'weak_password' },
    })

    const result = await signUp(input)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION')
      expect(result.error.fieldErrors?.password).toBeDefined()
    }
  })
})

describe('signIn', () => {
  beforeEach(() => {
    signInMock.mockReset()
    findUserById.mockReset()
  })

  it('reports bad credentials without revealing whether the email exists', async () => {
    signInMock.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials', code: 'invalid_credentials' },
    })

    const result = await signIn({ email: 'a@b.com', password: 'wrong' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('UNAUTHENTICATED')
      expect(result.error.message).toMatch(/email or password/i)
      expect(result.error.message).not.toMatch(/no account|not found|does not exist/i)
    }
  })

  it('returns the role so the caller knows which workspace to open', async () => {
    signInMock.mockResolvedValue({ data: { user: { id: 'uid-1' } }, error: null })
    findUserById.mockResolvedValue({ id: 'uid-1', role: 'EMPLOYER', onboardedAt: null })

    const result = await signIn({ email: 'a@b.com', password: 'right' })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.role).toBe('EMPLOYER')
      expect(result.value.onboarded).toBe(false)
    }
  })

  // Review Focus 1, from the other side: an auth user whose profile row never
  // landed must not be dropped into a workspace that will crash on user.role.
  it('refuses a sign-in whose profile row is missing', async () => {
    signInMock.mockResolvedValue({ data: { user: { id: 'uid-1' } }, error: null })
    findUserById.mockResolvedValue(null)

    const result = await signIn({ email: 'a@b.com', password: 'right' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INTERNAL')
  })
})

describe('signUp under Supabase default configuration (email confirmation on)', () => {
  beforeEach(() => {
    signUpMock.mockReset()
    createUserWithRole.mockReset()
    findUserById.mockReset()
  })

  // With confirmations enabled, GoTrue does NOT return an error for an existing
  // confirmed address. It returns an obfuscated user with a *fresh random* id and
  // an empty identities array. Branching only on `error` writes a second User row
  // keyed on a uuid that no session will ever carry.
  it('detects an existing account from an empty identities array', async () => {
    signUpMock.mockResolvedValue({
      data: {
        user: { id: 'random-obfuscated-uuid', identities: [], email: 'a@b.com' },
        session: null,
      },
      error: null,
    })

    const result = await signUp(input)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('CONFLICT')
      expect(result.error.message).toMatch(/already registered/i)
    }
    expect(createUserWithRole).not.toHaveBeenCalled()
  })

  // A genuine new signup with confirmations on has no session yet. Reporting it
  // as signed in sends the person to onboarding, which finds no session and
  // bounces them to the login page with no explanation.
  it('reports a genuine new signup as needing confirmation rather than signed in', async () => {
    signUpMock.mockResolvedValue({
      data: {
        user: { id: 'uid-new', identities: [{ id: 'i-1' }], email: 'new@b.com' },
        session: null,
      },
      error: null,
    })
    createUserWithRole.mockResolvedValue({
      id: 'uid-new',
      role: 'CANDIDATE',
      onboardedAt: null,
      candidateProfile: null,
      employerProfile: null,
    })

    const result = await signUp({ ...input, email: 'new@b.com' })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.needsEmailConfirmation).toBe(true)
    // The profile row is still written, so confirming the email lands on a
    // complete account rather than the missing-profile dead end.
    expect(createUserWithRole).toHaveBeenCalled()
  })

  it('reports an immediately-usable signup when confirmations are off', async () => {
    signUpMock.mockResolvedValue({
      data: {
        user: { id: 'uid-new', identities: [{ id: 'i-1' }], email: 'new@b.com' },
        session: { access_token: 'tok' },
      },
      error: null,
    })
    createUserWithRole.mockResolvedValue({
      id: 'uid-new',
      role: 'CANDIDATE',
      onboardedAt: null,
      candidateProfile: null,
      employerProfile: null,
    })

    const result = await signUp({ ...input, email: 'new@b.com' })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.needsEmailConfirmation).toBe(false)
  })

  it('still detects an existing account when identities is absent entirely', async () => {
    signUpMock.mockResolvedValue({
      data: { user: { id: 'random-uuid', email: 'a@b.com' }, session: null },
      error: null,
    })
    createUserWithRole.mockResolvedValue({
      id: 'random-uuid',
      role: 'CANDIDATE',
      onboardedAt: null,
      candidateProfile: null,
      employerProfile: null,
    })

    const result = await signUp(input)

    // An absent array is not evidence of a duplicate, so this must NOT be a
    // false CONFLICT — it proceeds and relies on the unique constraint.
    expect(result.ok).toBe(true)
  })
})

/**
 * A suspended account must be turned away at the door, with the reason.
 *
 * `getCurrentUser` returns null for a suspended user, so sign-in "succeeded"
 * and then every page bounced them back to login — which bounced them forward
 * again. They looped, with valid credentials, no message, and the notification
 * explaining the suspension sitting on a page they could not reach.
 */
describe('signing in while suspended', () => {
  beforeEach(() => {
    signInMock.mockReset()
    findUserById.mockReset()
    signOutMock.mockReset()
    signInMock.mockResolvedValue({ data: { user: { id: 'uid-1' } }, error: null })
    signOutMock.mockResolvedValue({ error: null })
  })

  function suspended(reason: string | null = 'Spam listings') {
    return {
      id: 'uid-1',
      email: 'a@b.com',
      name: 'Rafat',
      role: 'EMPLOYER',
      onboardedAt: new Date(),
      suspendedAt: new Date(),
      suspendedReason: reason,
    }
  }

  it('refuses the sign-in rather than letting it loop', async () => {
    findUserById.mockResolvedValue(suspended())

    const result = await signIn({ email: 'a@b.com', password: 'longenough1' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN')
  })

  // The reason is the only thing they can appeal against.
  it('tells them why', async () => {
    findUserById.mockResolvedValue(suspended('Spam listings'))

    const result = await signIn({ email: 'a@b.com', password: 'longenough1' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toContain('Spam listings')
  })

  it('still says something useful when no reason was recorded', async () => {
    findUserById.mockResolvedValue(suspended(null))

    const result = await signIn({ email: 'a@b.com', password: 'longenough1' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toMatch(/suspended/i)
  })

  // Supabase issued a session before we looked at the row. Leaving it in place
  // would let a suspended person carry a valid cookie around the app.
  it('discards the session Supabase just issued', async () => {
    findUserById.mockResolvedValue(suspended())

    await signIn({ email: 'a@b.com', password: 'longenough1' })

    expect(signOutMock).toHaveBeenCalled()
  })

  it('lets an account whose suspension was lifted back in', async () => {
    findUserById.mockResolvedValue({ ...suspended(), suspendedAt: null, suspendedReason: null })

    const result = await signIn({ email: 'a@b.com', password: 'longenough1' })

    expect(result.ok).toBe(true)
  })
})
