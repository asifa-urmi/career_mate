import 'server-only'

import { prisma } from '@/lib/db/prisma'
import { appError } from '@/lib/utils/errors'
import { err, ok, type Result } from '@/lib/utils/result'
import type { SessionUser } from '@/lib/auth/session'
import type { JobInput } from '@/lib/validation/job.schema'

/**
 * A job belongs to a company, not to the person who typed it.
 *
 * Every ownership predicate below is `companyId`, never `postedById`: a
 * colleague must be able to edit, publish and close a role someone else at the
 * same company posted, and the person who posted it may have left.
 */
async function companyIdFor(userId: string): Promise<string | null> {
  const employer = await prisma.employerProfile.findUnique({
    where: { userId },
    select: { companyId: true },
  })
  return employer?.companyId ?? null
}

function requireEmployer(user: SessionUser): Result<void> {
  if (user.role !== 'EMPLOYER') {
    return err(appError('FORBIDDEN', 'Only an employer account can manage job posts.'))
  }
  return ok(undefined)
}

/** The fields a job post owns. Never status, never moderation. */
function contentFrom(input: JobInput) {
  return {
    title: input.title,
    category: input.category,
    location: input.location,
    workMode: input.workMode,
    jobType: input.jobType,
    salaryMinBdt: input.salaryMinBdt ?? null,
    salaryMaxBdt: input.salaryMaxBdt ?? null,
    salaryNote: input.salaryNote ?? null,
    summary: input.summary,
    responsibilities: input.responsibilities,
    requirements: input.requirements,
    requiredSkills: input.requiredSkills,
    preferredSkills: input.preferredSkills,
    screeningQuestions: input.screeningQuestions,
  }
}

/**
 * Always creates a DRAFT awaiting moderation, whatever the request said.
 * Accepting a status from the payload would let a crafted POST publish and
 * self-approve a listing straight onto the public board.
 */
export async function createJobPosting(
  user: SessionUser,
  input: JobInput,
): Promise<Result<{ jobId: string }>> {
  const allowed = requireEmployer(user)
  if (!allowed.ok) return allowed

  const companyId = await companyIdFor(user.id)
  if (!companyId) {
    return err(appError('NOT_FOUND', 'Finish setting up your company before posting a role.'))
  }

  try {
    const job = await prisma.job.create({
      data: {
        ...contentFrom(input),
        companyId,
        postedById: user.id,
        status: 'DRAFT',
        moderation: 'PENDING',
      },
      select: { id: true },
    })
    return ok({ jobId: job.id })
  } catch {
    return err(appError('INTERNAL', 'We could not save that job. Please try again.'))
  }
}

/**
 * `updateMany` with the ownership predicate in the `where` is deliberate: the
 * row is never fetched before it is authorized, and a zero count means "not
 * yours or not there" without distinguishing the two.
 */
export async function updateJobPosting(
  user: SessionUser,
  jobId: string,
  input: JobInput,
): Promise<Result<void>> {
  const allowed = requireEmployer(user)
  if (!allowed.ok) return allowed

  const companyId = await companyIdFor(user.id)
  if (!companyId) return err(appError('NOT_FOUND', 'We could not find your company.'))

  try {
    const result = await prisma.job.updateMany({
      where: { id: jobId, companyId },
      data: contentFrom(input),
    })
    if (result.count === 0) return err(appError('NOT_FOUND', 'We could not find that job.'))
    return ok(undefined)
  } catch {
    return err(appError('INTERNAL', 'We could not save that job. Please try again.'))
  }
}

/**
 * Publishing is the employer's decision; approval is not theirs to make. A
 * PUBLISHED job whose moderation is still PENDING stays off the public board,
 * because every public read requires both.
 */
export async function publishJobPosting(
  user: SessionUser,
  jobId: string,
): Promise<Result<void>> {
  const allowed = requireEmployer(user)
  if (!allowed.ok) return allowed

  const companyId = await companyIdFor(user.id)
  if (!companyId) return err(appError('NOT_FOUND', 'We could not find your company.'))

  try {
    const result = await prisma.job.updateMany({
      where: { id: jobId, companyId },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    })
    if (result.count === 0) return err(appError('NOT_FOUND', 'We could not find that job.'))
    return ok(undefined)
  } catch {
    return err(appError('INTERNAL', 'We could not publish that job. Please try again.'))
  }
}

export async function closeJobPosting(user: SessionUser, jobId: string): Promise<Result<void>> {
  const allowed = requireEmployer(user)
  if (!allowed.ok) return allowed

  const companyId = await companyIdFor(user.id)
  if (!companyId) return err(appError('NOT_FOUND', 'We could not find your company.'))

  try {
    const result = await prisma.job.updateMany({
      where: { id: jobId, companyId },
      data: { status: 'CLOSED' },
    })
    if (result.count === 0) return err(appError('NOT_FOUND', 'We could not find that job.'))
    return ok(undefined)
  } catch {
    return err(appError('INTERNAL', 'We could not close that job. Please try again.'))
  }
}
