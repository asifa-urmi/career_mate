import { z } from 'zod'

/**
 * Emails are trimmed and lower-cased so the same address cannot register twice
 * under different capitalisation, and so a sign-in typed with a capital first
 * letter still matches the stored row.
 */
const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Enter your email address')
  .email('Enter a valid email address')

/**
 * ADMIN is absent on purpose. Platform administrators are provisioned by a direct
 * database update, so a crafted POST setting `role: "ADMIN"` is rejected here
 * rather than creating one.
 */
export const signupSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name'),
  email,
  // Not trimmed: a space is a legitimate password character and silently
  // stripping it would lock people out of a password they typed correctly.
  password: z.string().min(8, 'Use at least 8 characters'),
  role: z.enum(['CANDIDATE', 'EMPLOYER'], {
    message: 'Choose whether you are looking for work or hiring',
  }),
})

export type SignupInput = z.infer<typeof signupSchema>

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
})

export type LoginInput = z.infer<typeof loginSchema>
