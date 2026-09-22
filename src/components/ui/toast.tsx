'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { cn } from '@/lib/utils/cn'

type Toast = { id: number; message: string; tone: 'info' | 'success' | 'error' }
type ToastContextValue = { show: (message: string, tone?: Toast['tone']) => void }

const ToastContext = createContext<ToastContextValue | null>(null)

const TONE: Record<Toast['tone'], string> = {
  info: 'bg-navy text-white',
  success: 'bg-mint text-[#06382f]',
  error: 'bg-danger text-white',
}

/**
 * Replaces the prototype's global `toast()` function. Mounted once in the root
 * layout; anything below it calls `useToast()`.
 *
 * `aria-live="polite"` is what makes an announcement reach a screen reader — the
 * prototype's version was visual only, so a blind user got no confirmation that
 * their application had been submitted.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback((message: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((current) => [...current, { id, message, tone }])
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id))
    }, 3200)
  }, [])

  const value = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-6 z-[999] flex flex-col items-center gap-2 px-4"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto max-w-md rounded-[var(--radius-field)] px-4 py-3',
              'text-[13px] font-semibold shadow-[var(--shadow-card)]',
              TONE[t.tone],
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
