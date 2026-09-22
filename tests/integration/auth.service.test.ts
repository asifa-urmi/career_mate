import { beforeEach, describe, expect, it, vi } from 'vitest'

const signUpMock = vi.fn()
const signInMock = vi.fn()
const createUserWithRole = vi.fn()
const findUserById = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: async () => ({
    auth: { signUp: signUpMock, signInWithPassword: signInMock, signOut: vi.fn() },
  }),
}))
vi.mock('@/lib/db/repositories/user.repository', () => ({ createUserWithRole, findUserById }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { signUp, signIn } = await import('@/server/services/auth.service')

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
