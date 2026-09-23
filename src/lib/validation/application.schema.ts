import { z } from 'zod'

/**
 * Screening answers arrive keyed by the question's index, not by its text, so
 * an employer editing a job's questions later cannot rewrite what someone
 * already said. The index is preserved alongside the question list that was
 * shown at the time.
 */
const screeningAnswers = z.record(z.string(), z.string().trim().max(2000)).default({})

export const applicationSchema = z.object({
  jobId: z.string().trim().min(1),
  resumeId: z
    .string()
    .trim()
    .transform((v) => (v === '' ? undefined : v))
    .optional(),
  coverLetter: z
    .string()
    .trim()
    .max(4000, 'Keep your cover letter under 4000 characters')
    .transform((v) => (v === '' ? undefined : v))
    .optional(),
  screeningAnswers,
  // A literal rather than a boolean: consent must be actively given, and an
  // absent or false checkbox is a validation error rather than a silent false.
  consented: z.literal(true, {
    message: 'Confirm that your information is accurate before submitting',
  }),
})

export type ApplicationInput = z.infer<typeof applicationSchema>
