import { cn } from '@/lib/utils/cn'

const CONTROL =
  'w-full rounded-[var(--radius-field)] border border-line bg-surface px-3.5 py-3 text-sm ' +
  'outline-none transition-colors placeholder:text-muted/70 focus:border-blue ' +
  'aria-[invalid=true]:border-danger disabled:bg-bg disabled:text-muted'

export function Input({ className, ...rest }: React.ComponentPropsWithoutRef<'input'>) {
  return <input {...rest} className={cn(CONTROL, className)} />
}

export function Textarea({ className, ...rest }: React.ComponentPropsWithoutRef<'textarea'>) {
  return <textarea {...rest} className={cn(CONTROL, 'resize-y', className)} />
}

export function Select({
  options,
  className,
  placeholder,
  ...rest
}: {
  options: readonly { value: string; label: string }[]
  placeholder?: string
} & Omit<React.ComponentPropsWithoutRef<'select'>, 'children'>) {
  return (
    <select {...rest} className={cn(CONTROL, 'appearance-none pr-9', className)}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

/**
 * The one place a form field's label, hint and validation errors are rendered.
 *
 * Every form in the app wraps its controls in this, so error display is uniform
 * and `aria-invalid` / `aria-describedby` are wired the same way everywhere —
 * which is what makes the errors reach a screen reader rather than only the eye.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  className,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  error?: string[] | undefined
  required?: boolean
  className?: string
  children: React.ReactNode
}) {
  const hasError = Boolean(error?.length)
  const errorId = htmlFor ? `${htmlFor}-error` : undefined
  const hintId = htmlFor ? `${htmlFor}-hint` : undefined

  return (
    <div className={cn('grid gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-bold text-navy">
        {label}
        {required && (
          <span className="text-danger" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>

      {children}

      {hint && !hasError && (
        <p id={hintId} className="m-0 text-xs text-muted">
          {hint}
        </p>
      )}

      {hasError && (
        <p id={errorId} className="m-0 text-xs font-semibold text-danger" role="alert">
          {error?.join(' ')}
        </p>
      )}
    </div>
  )
}
