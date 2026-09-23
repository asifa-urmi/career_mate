/**
 * The reasons someone can give for reporting a job or an account.
 *
 * Shared, not owned by the service: the browser renders them as the select's
 * options and the server validates against the same list, so a reason the form
 * can offer is always one the service will accept. Keeping it here is what stops
 * the report form from importing a service — and with it Prisma — into the
 * browser bundle.
 */
export const REPORT_REASONS = [
  'Misleading job description',
  'Asks for payment or fees',
  'Discriminatory requirements',
  'Not a real role',
  'Harassment or abuse',
  'Something else',
] as const

export type ReportReason = (typeof REPORT_REASONS)[number]
