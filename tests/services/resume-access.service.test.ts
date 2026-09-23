import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionUser } from '@/lib/auth/session'

const findResume = vi.fn()
const findEmployer = vi.fn()
const signUrl = vi.fn()

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    resume: { findFirst: findResume },
    employerProfile: { findUnique: findEmployer },
  },
}))
vi.mock('@/lib/supabase/storage', () => ({ createSignedResumeUrl: signUrl }))

const { signedResumeUrl } = await import('@/server/services/resume-access.service')

function user(role: SessionUser['role'], id = 'uid-1'): SessionUser {
  return {
    id,
    email: 'a@b.com',
    name: 'A',
    avatarUrl: null,
    role,
    onboardedAt: new Date(),
    onboarded: true,
  }
}

beforeEach(() => {
  findResume.mockReset()
  findEmployer.mockReset()
  signUrl.mockReset()
  findResume.mockResolvedValue({ storagePath: 'cp-1/res-1/cv.pdf', fileName: 'cv.pdf' })
  findEmployer.mockResolvedValue({ companyId: 'co-1' })
  signUrl.mockResolvedValue({ ok: true, url: 'https://signed.example/cv.pdf?token=x' })
})

describe('a candidate', () => {
  it('can download their own CV', async () => {
    const result = await signedResumeUrl(user('CANDIDATE'), 'res-1')

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.url).toContain('token=')
  })

  it('is scoped to their own profile in the where clause', async () => {
    await signedResumeUrl(user('CANDIDATE'), 'res-1')

    expect(findResume.mock.calls[0]?.[0]?.where).toMatchObject({
      id: 'res-1',
      candidateProfile: { userId: 'uid-1' },
    })
  })

  it('gets not found for another candidate CV, never a distinguishable refusal', async () => {
    findResume.mockResolvedValue(null)

    const result = await signedResumeUrl(user('CANDIDATE'), 'someone-elses')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
    expect(signUrl).not.toHaveBeenCalled()
  })
})

describe('an employer', () => {
  // Review Focus 4. Without the application link, knowing an id would be enough
  // to read any candidate's CV on the platform.
  it('may only reach a CV attached to an application to their own company job', async () => {
    await signedResumeUrl(user('EMPLOYER'), 'res-1')

    expect(findResume.mock.calls[0]?.[0]?.where).toMatchObject({
      id: 'res-1',
      applications: { some: { job: { companyId: 'co-1' } } },
    })
  })

  it('is refused a CV from another company application, with nothing minted', async () => {
    findResume.mockResolvedValue(null)

    const result = await signedResumeUrl(user('EMPLOYER'), 'another-company-cv')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
    expect(signUrl).not.toHaveBeenCalled()
  })

  it('is refused when they have no company at all', async () => {
    findEmployer.mockResolvedValue(null)

    const result = await signedResumeUrl(user('EMPLOYER'), 'res-1')

    expect(result.ok).toBe(false)
    expect(findResume).not.toHaveBeenCalled()
    expect(signUrl).not.toHaveBeenCalled()
  })

  /**
   * Mocking the query to return nothing and asserting failure proves nothing —
   * it tests the mock. What carries weight is the predicate the service sends,
   * which is the thing that would let an employer read any CV by id if it were
   * dropped.
   */
  it('derives the entitlement from an application to its own company job', async () => {
    await signedResumeUrl(user('EMPLOYER'), 'res-1')

    expect(findResume.mock.calls[0]?.[0]?.where).toMatchObject({
      id: 'res-1',
      applications: { some: { job: { companyId: 'co-1' } } },
    })
  })

  it('never asks by resume id alone', async () => {
    await signedResumeUrl(user('EMPLOYER'), 'res-1')

    expect(findResume.mock.calls[0]?.[0]?.where).not.toEqual({ id: 'res-1' })
  })
})

describe('an admin', () => {
  it('may reach any CV, which is why stage changes record an actor', async () => {
    await signedResumeUrl(user('ADMIN'), 'res-1')

    expect(findResume.mock.calls[0]?.[0]?.where).toEqual({ id: 'res-1' })
  })
})

describe('link creation', () => {
  it('asks for the original file name so the download is not a uuid', async () => {
    await signedResumeUrl(user('CANDIDATE'), 'res-1')

    expect(signUrl).toHaveBeenCalledWith('cp-1/res-1/cv.pdf', 'cv.pdf')
  })

  it('reports a storage failure as a handled error', async () => {
    signUrl.mockResolvedValue({ ok: false, message: 'storage down' })

    const result = await signedResumeUrl(user('CANDIDATE'), 'res-1')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INTERNAL')
  })
})

