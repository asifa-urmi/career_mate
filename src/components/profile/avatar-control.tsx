'use client'

import { useActionState, useRef, useState, useTransition } from 'react'
import { Avatar, Button, useToast } from '@/components/ui'
import { validateUpload } from '@/lib/validation/file'
import { ACCEPTED_AVATAR_EXTENSIONS, ACCEPTED_AVATAR_MIME, MAX_AVATAR_BYTES } from '@/config/constants'
import {
  removeAvatarAction,
  updateAvatarAction,
  type AvatarState,
} from '@/app/(candidate)/profile/actions'

/**
 * The profile photo, changed in place.
 *
 * The picture itself is the button. A separate "choose file" control beside a
 * preview asks people to understand two things where one will do, and at this
 * size the photo is the only thing on screen worth clicking.
 *
 * Size and type are checked here as well as in the service. Not as a security
 * measure — this runs in the browser and cannot be one — but so that choosing a
 * 9 MB photo fails instantly and locally rather than after the upload.
 */
export function AvatarControl({ name, src }: { name: string; src: string | null }) {
  const [state, action, pending] = useActionState<AvatarState, FormData>(updateAvatarAction, {})
  const [removing, startRemoving] = useTransition()
  const [localError, setLocalError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { show } = useToast()

  function chosen(file: File | undefined) {
    if (!file) return

    const rejection = validateUpload(file, ACCEPTED_AVATAR_MIME, MAX_AVATAR_BYTES)
    if (rejection) {
      setLocalError(rejection.message)
      // Or the same rejected file stays selected and the next pick of it is a
      // no-op, because the input's value has not changed.
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    setLocalError(null)
    formRef.current?.requestSubmit()
  }

  const busy = pending || removing
  const error = localError ?? state.error

  return (
    <form ref={formRef} action={action} className="grid gap-2">
      <input
        ref={inputRef}
        type="file"
        name="avatar"
        accept={ACCEPTED_AVATAR_EXTENSIONS}
        className="sr-only"
        onChange={(e) => chosen(e.target.files?.[0])}
        disabled={busy}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="group relative grid place-items-center rounded-full ring-4 ring-white disabled:opacity-60"
        style={{ width: 84, height: 84 }}
        aria-label={src ? 'Change your profile photo' : 'Add a profile photo'}
      >
        <Avatar name={name} src={src} size={84} />
        <span className="absolute inset-0 grid place-items-center rounded-full bg-navy/60 text-[11px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {busy ? '…' : src ? 'Change' : 'Add photo'}
        </span>
      </button>

      <div className="flex min-h-5 items-center gap-2">
        {error ? (
          <span role="alert" className="text-xs font-semibold text-danger">
            {error}
          </span>
        ) : (
          src && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              loading={removing}
              onClick={() =>
                startRemoving(async () => {
                  const result = await removeAvatarAction()
                  show(result.error ?? 'Photo removed', result.error ? 'error' : 'success')
                })
              }
            >
              Remove photo
            </Button>
          )
        )}
      </div>
    </form>
  )
}
