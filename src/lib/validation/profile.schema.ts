import { z } from 'zod'
import { JOB_CATEGORY_VALUES } from './onboarding.schema'

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? undefined : v))
    .optional()

/** A `<input type="date">` value, or nothing. */
const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v === '' ? undefined : v))
  .optional()
  .refine((v) => v === undefined || !Number.isNaN(Date.parse(v)), {
    message: 'Enter a valid date',
  })
  .transform((v) => (v === undefined ? undefined : new Date(v)))

const requiredDate = z
  .string()
  .trim()
  .min(1, 'Enter a start date')
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Enter a valid date' })
  .transform((v) => new Date(v))

/**
 * Only http and https.
 *
 * A bare domain renders as a relative link and navigates inside the app instead
 * of out of it. `javascript:` and `data:` are worse: a profile link is rendered
 * into an anchor other people click, so either would be stored XSS.
 */
const safeUrl = z
  .string()
  .trim()
  .min(1, 'Enter a link')
  .refine(
    (v) => {
      try {
        const parsed = new URL(v)
        return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      } catch {
        return false
      }
    },
    { message: 'Enter a full link starting with https://' },
  )

export const basicsSchema = z.object({
  headline: optionalText(160),
  location: optionalText(120),
  bio: optionalText(2000),
  experienceLevel: z.enum(['ENTRY', 'ONE_TO_THREE', 'THREE_TO_FIVE', 'FIVE_PLUS']),
  primarySector: z.enum(JOB_CATEGORY_VALUES),
})

export type BasicsInput = z.infer<typeof basicsSchema>

export const experienceSchema = z
  .object({
    id: optionalText(40),
    title: z.string().trim().min(1, 'What was the role called?').max(120),
    company: z.string().trim().min(1, 'Which organisation?').max(120),
    startDate: requiredDate,
    endDate: optionalDate,
    isCurrent: z.coerce.boolean().default(false),
    description: optionalText(2000),
  })
  .superRefine((value, ctx) => {
    if (value.startDate.getTime() > Date.now()) {
      ctx.addIssue({
        code: 'custom',
        path: ['startDate'],
        message: 'A start date cannot be in the future',
      })
    }

    // A current role with an end date would render "Present" while the data says
    // otherwise; a finished role without one loses when it ended.
    if (value.isCurrent && value.endDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'Remove the end date, or untick "I still work here"',
      })
      return
    }

    if (!value.isCurrent && !value.endDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'When did this role end?',
      })
      return
    }

    if (value.endDate && value.endDate.getTime() < value.startDate.getTime()) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'The end date cannot be before the start date',
      })
    }
  })

export type ExperienceInput = z.infer<typeof experienceSchema>

export const educationSchema = z
  .object({
    id: optionalText(40),
    degree: z.string().trim().min(1, 'What did you study?').max(160),
    institution: z.string().trim().min(1, 'Where?').max(160),
    fieldOfStudy: optionalText(160),
    startDate: optionalDate,
    endDate: optionalDate,
    grade: optionalText(60),
  })
  .superRefine((value, ctx) => {
    if (
      value.startDate &&
      value.endDate &&
      value.endDate.getTime() < value.startDate.getTime()
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'The end date cannot be before the start date',
      })
    }
  })

export type EducationInput = z.infer<typeof educationSchema>

/**
 * Skills arrive as one comma-separated field. De-duplicated case-insensitively
 * so a list does not read "Excel, excel, EXCEL", keeping the first spelling
 * because that is the one the person chose.
 */
export const skillsSchema = z.object({
  skills: z
    .string()
    .transform((value) => {
      const seen = new Set<string>()
      const out: string[] = []
      for (const raw of value.split(',')) {
        const skill = raw.trim()
        if (!skill) continue
        const key = skill.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        out.push(skill)
      }
      return out
    })
    .pipe(z.array(z.string().max(60)).max(30, 'Thirty skills is the maximum')),
})

export type SkillsInput = z.infer<typeof skillsSchema>

export const linksSchema = z.object({
  id: optionalText(40),
  label: z.string().trim().min(1, 'Give the link a name').max(60),
  url: safeUrl,
})

export type LinkInput = z.infer<typeof linksSchema>
