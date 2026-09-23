import { z } from 'zod'
import { JOB_CATEGORY_VALUES } from './onboarding.schema'

const MAX_SALARY_BDT = 100_000_000

/**
 * A bullet list from a textarea: one item per line, blanks dropped.
 *
 * Without the filter an accidental double newline becomes an empty bullet in a
 * live job post, which looks like the page failed to load.
 */
const bulletList = (max: number) =>
  z
    .array(z.string().trim().max(500))
    .transform((items) => items.map((i) => i.trim()).filter(Boolean))
    .pipe(z.array(z.string()).max(max))

/**
 * Skills, de-duplicated case-insensitively keeping the first spelling — so a
 * list does not read "Excel, excel, EXCEL", and the search's case variants have
 * something consistent to match.
 */
const skillList = z
  .array(z.string().trim().max(60))
  .transform((items) => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const item of items) {
      const trimmed = item.trim()
      if (!trimmed) continue
      const key = trimmed.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(trimmed)
    }
    return out
  })
  .pipe(z.array(z.string()).max(20))

const optionalSalary = z
  .union([z.literal(''), z.coerce.number()])
  .transform((v) => (v === '' ? undefined : v))
  .optional()
  .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), {
    message: 'Enter a positive amount',
  })
  .refine((v) => v === undefined || v <= MAX_SALARY_BDT, {
    message: 'That salary looks too large',
  })

/**
 * `status` and `moderation` are deliberately absent.
 *
 * They are set by the service — a job is created as a DRAFT awaiting
 * moderation regardless of what the request asked for. Accepting them here
 * would let a crafted POST publish and self-approve its own listing.
 */
export const jobSchema = z
  .object({
    title: z.string().trim().min(3, 'Give the role a title').max(120),
    category: z.enum(JOB_CATEGORY_VALUES, { message: 'Choose a sector' }),
    location: z.string().trim().min(2, 'Where is this role based?').max(120),
    workMode: z.enum(['ANY', 'ONSITE', 'HYBRID', 'REMOTE'], { message: 'Choose a work mode' }),
    jobType: z.enum(['FULL_TIME', 'PART_TIME', 'INTERNSHIP', 'CONTRACT'], {
      message: 'Choose a job type',
    }),
    salaryMinBdt: optionalSalary,
    salaryMaxBdt: optionalSalary,
    salaryNote: z
      .string()
      .trim()
      .max(60)
      .transform((v) => (v === '' ? undefined : v))
      .optional(),
    summary: z
      .string()
      .trim()
      .min(30, 'Write at least a sentence about the role')
      .max(600),
    responsibilities: bulletList(15).refine((v) => v.length > 0, {
      message: 'Add at least one responsibility',
    }),
    requirements: bulletList(15),
    requiredSkills: skillList,
    preferredSkills: skillList,
    screeningQuestions: z
      .array(z.string().trim().max(200, 'Keep each question under 200 characters'))
      .transform((items) => items.map((i) => i.trim()).filter(Boolean))
      .pipe(z.array(z.string()).max(10, 'Ten screening questions is the maximum')),
  })
  .superRefine((value, ctx) => {
    if (
      value.salaryMinBdt !== undefined &&
      value.salaryMaxBdt !== undefined &&
      value.salaryMinBdt > value.salaryMaxBdt
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['salaryMinBdt'],
        message: 'The minimum cannot be higher than the maximum',
      })
    }
  })

export type JobInput = z.infer<typeof jobSchema>
