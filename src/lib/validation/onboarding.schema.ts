import { z } from 'zod'
import type { JobCategory } from '@prisma/client'
import { CATEGORIES } from '@/config/categories'

/**
 * Derived from CATEGORIES rather than hand-copied, so a category added to the
 * Prisma enum and the UI list cannot be left silently unsubmittable.
 * `tests/unit/category-sources.test.ts` asserts all three agree.
 */
export const JOB_CATEGORY_VALUES = CATEGORIES.map((c) => c.value) as [
  JobCategory,
  ...JobCategory[],
]

/** A sane ceiling. Anything above it is a typo or an attempt to overflow the column. */
const MAX_SALARY_BDT = 100_000_000

/**
 * An optional text field submitted by a form arrives as `""`, not as absent.
 * Storing that empty string would put a meaningless row in the database and make
 * "has the user set a target role?" false-positive everywhere downstream.
 */
const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? undefined : v))
    .optional()

/** Same problem for numbers: `""` must mean "no preference", not zero. */
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
 * An empty field is not an invalid url, it is an absent one.
 *
 * Only http and https. Zod's `.url()` accepts `javascript:alert(1)` and
 * `data:text/html,...`, which become stored XSS the moment a company's website
 * is rendered as an anchor - and a public company page is the obvious next thing
 * to build. Same rule as the profile links, for the same reason.
 */
const optionalUrl = z
  .union([
    z.literal(''),
    z
      .string()
      .trim()
      .refine(
        (v) => {
          try {
            const parsed = new URL(v)
            return parsed.protocol === 'http:' || parsed.protocol === 'https:'
          } catch {
            return false
          }
        },
        { message: 'Enter a full address, including https://' },
      ),
  ])
  .transform((v) => (v === '' ? undefined : v))
  .optional()

export const onboardingSchema = z.object({
  primarySector: z.enum(JOB_CATEGORY_VALUES, { message: 'Choose the sector you want to work in' }),
  targetRole: optionalText(120),
  experienceLevel: z.enum(['ENTRY', 'ONE_TO_THREE', 'THREE_TO_FIVE', 'FIVE_PLUS'], {
    message: 'Choose your experience level',
  }),
  preferredLocation: optionalText(120),
  jobType: z.enum(['FULL_TIME', 'PART_TIME', 'INTERNSHIP', 'CONTRACT'], {
    message: 'Choose a job type',
  }),
  minSalaryBdt: optionalSalary,
  workMode: z.enum(['ANY', 'ONSITE', 'HYBRID', 'REMOTE'], { message: 'Choose a work mode' }),
  headline: optionalText(160),
})

export type OnboardingInput = z.infer<typeof onboardingSchema>

export const companySetupSchema = z.object({
  companyName: z.string().trim().min(2, 'Enter your company name').max(120),
  sector: z.enum(JOB_CATEGORY_VALUES, { message: 'Choose your company sector' }),
  size: optionalText(60),
  website: optionalUrl,
  location: optionalText(120),
  about: optionalText(2000),
  title: optionalText(120),
})

export type CompanySetupInput = z.infer<typeof companySetupSchema>
