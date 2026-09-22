type ClassValue = string | false | null | undefined

/** Joins class names, dropping anything falsy. */
export function cn(...classes: ClassValue[]): string {
  return classes.filter((c): c is string => Boolean(c)).join(' ')
}
