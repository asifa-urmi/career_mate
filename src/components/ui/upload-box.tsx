'use client'

import { useId, useRef, useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { validateUpload } from '@/lib/validation/file'

export function UploadBox({
  accept,
  acceptExtensions,
  maxBytes,
  onFile,
  disabled = false,
  hint,
  name,
  inputRef: externalRef,
}: {
  accept: readonly string[]
  acceptExtensions: string
  maxBytes: number
  onFile: (file: File) => void
  disabled?: boolean
  hint?: string
  name?: string
  /** Lets a form own the input, so the chosen file is submitted with it. */
  inputRef?: React.RefObject<HTMLInputElement | null>
}) {
  const ownRef = useRef<HTMLInputElement>(null)
  const inputRef = externalRef ?? ownRef
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const errorId = useId()

  function accepted(file: File) {
    const rejection = validateUpload(file, accept, maxBytes)
    if (rejection) {
      setError(rejection.message)
      return
    }
    setError(null)
    onFile(file)
  }

  const maxMb = Math.round(maxBytes / (1024 * 1024))

  return (
    <div className="grid gap-2">
      {/* A real button, so the drop zone is reachable by keyboard. The prototype's
          version was a div with an onclick and could not be tabbed to at all. */}
      <button
        type="button"
        disabled={disabled}
        aria-describedby={error ? errorId : undefined}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (disabled) return
          const file = e.dataTransfer.files[0]
          if (file) accepted(file)
        }}
        data-dragging={dragging}
        className={cn(
          'upload-box grid w-full place-items-center gap-1 rounded-2xl px-6 py-10 text-center',
          'transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        )}
      >
        <span className="text-4xl leading-none" aria-hidden="true">
          ⇧
        </span>
        <strong className="font-display text-sm">Drop a PDF or DOCX here, or click to browse</strong>
        <span className="text-xs text-muted">Max {maxMb} MB</span>
        {hint && <span className="mt-1 text-xs text-muted">{hint}</span>}
      </button>

      <input
        ref={inputRef}
        type="file"
        name={name}
        accept={acceptExtensions}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) accepted(file)
        }}
      />

      {error && (
        <p id={errorId} role="alert" className="m-0 text-xs font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
