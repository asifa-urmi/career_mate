import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionUser } from '@/lib/auth/session'

const findEmployer = vi.fn()
const findCompany = vi.fn()
const updateCompany = vi.fn()
const updateEmployer = vi.fn()
const transaction = vi.fn()

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    employerProfile: { findUnique: findEmployer, update: updateEmployer },
    company: { findFirst: findCompany, update: updateCompany },
    $transaction: (ops: unknown[]) => transaction(ops),
  },
}))

const { updateCompanyProfile } = await import('@/server/services/company.service')

function user(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'uid-emp',
    email: 'e@f.com',
    name: 'E',
    avatarUrl: null,
    role: 'EMPLOYER',
    onboardedAt: new Date(),
    onboarded: true,
    ...overrides,
  }
}

const input = {
  companyName: 'Nexa Labs',
  sector: 'TECHNOLOGY' as const,
  size: '11–50',
  website: 'https://nexalabs.com',
  location: 'Dhaka',
  about: 'Product engineering.',
  title: 'HR Manager',
}

beforeEach(() => {
  for (const m of [findEmployer, findCompany, updateCompany, updateEmployer, transaction]) {
    m.mockReset()
  }
  findEmployer.mockResolvedValue({ companyId: 'co-1' })
  findCompany.mockResolvedValue(null)
  updateCompany.mockReturnValue({ id: 'co-1' })
  updateEmployer.mockReturnValue({ id: 'ep-1' })
  transaction.mockResolvedValue([])
})

describe('updateCompanyProfile', () => {
  it('updates the caller own company', async () => {
    const result = await updateCompanyProfile(user(), input)

    expect(result.ok).toBe(true)
    expect(updateCompany.mock.calls[0]?.[0]?.where).toMatchObject({ id: 'co-1' })
  })

  it('refuses a candidate', async () => {
    const result = await updateCompanyProfile(user({ role: 'CANDIDATE' }), input)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN')
    expect(findEmployer).not.toHaveBeenCalled()
    expect(updateCompany).not.toHaveBeenCalled()
  })

  it('refuses an admin, who has no company of their own to edit', async () => {
    const result = await updateCompanyProfile(user({ role: 'ADMIN' }), input)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN')
  })

  it('refuses an employer with no company', async () => {
    findEmployer.mockResolvedValue(null)

    const result = await updateCompanyProfile(user(), input)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
    expect(updateCompany).not.toHaveBeenCalled()
  })

  // A badge a company could set itself is worthless. It is never in the payload
  // and must never be in the write.
  it('never writes the verified flag', async () => {
    await updateCompanyProfile(user(), { ...input, verified: true } as never)

    expect(JSON.stringify(updateCompany.mock.calls[0]?.[0]?.data)).not.toContain('verified')
  })

  it('cannot edit another company by id, because no id is accepted', async () => {
    await updateCompanyProfile(user(), { ...input, id: 'co-999' } as never)

    // The target comes from the caller's own employer profile, never the input.
    expect(updateCompany.mock.calls[0]?.[0]?.where).toEqual({ id: 'co-1' })
  })

  it('refuses a rename that collides with another company', async () => {
    findCompany.mockResolvedValue({ id: 'co-2' })

    const result = await updateCompanyProfile(user(), input)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('CONFLICT')
    expect(updateCompany).not.toHaveBeenCalled()
  })

  it('excludes itself from the name collision check, so saving unchanged works', async () => {
    await updateCompanyProfile(user(), input)

    expect(findCompany.mock.calls[0]?.[0]?.where).toMatchObject({
      name: { equals: 'Nexa Labs', mode: 'insensitive' },
      id: { not: 'co-1' },
    })
  })

  it('turns a database failure into a handled error', async () => {
    transaction.mockRejectedValue(new Error('connection lost'))

    const result = await updateCompanyProfile(user(), input)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INTERNAL')
  })
})
