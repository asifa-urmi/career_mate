'use client'

import { useActionState, useRef, useState, useTransition } from 'react'
import {
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  Input,
  Suggestion,
  UploadBox,
  useToast,
} from '@/components/ui'
import {
  ACCEPTED_RESUME_EXTENSIONS,
  ACCEPTED_RESUME_MIME,
  MAX_RESUME_BYTES,
} from '@/config/constants'
import { AiPanel } from '@/components/ai/ai-panel'
import {
  deleteResumeAction,
  downloadResumeAction,
  renameResumeAction,
  reviewCvAction,
  setPrimaryAction,
  uploadResumeAction,
  type ReviewState,
  type UploadState,
} from '@/app/(candidate)/resume/actions'

export type ResumeItem = {
  id: string
  label: string
  fileName: string
  sizeLabel: string
  uploadedLabel: string
  isPrimary: boolean
  hasText: boolean
}

export function ResumeManager({ resumes }: { resumes: ResumeItem[] }) {
  const [uploadState, uploadAction, uploading] = useActionState<UploadState, FormData>(
    uploadResumeAction,
    {},
  )
  const [review, setReview] = useState<ReviewState>({})
  const [reviewing, startReview] = useTransition()
  const [busy, startBusy] = useTransition()
  const { show } = useToast()
  const formRef = useRef<HTMLFormElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [chosen, setChosen] = useState<string | null>(null)

  function act(fn: () => Promise<{ error?: string }>, success: string) {
    startBusy(async () => {
      const result = await fn()
      show(result.error ?? success, result.error ? 'error' : 'success')
    })
  }

  function download(id: string) {
    startBusy(async () => {
      const result = await downloadResumeAction(id)
      if (result.error || !result.url) {
        show(result.error ?? 'Could not create a download link', 'error')
        return
      }
      // A short-lived signed URL. Opening it rather than embedding it keeps the
      // link out of the page source and out of the browser history of the tab.
      window.open(result.url, '_blank', 'noopener,noreferrer')
    })
  }

  return (
    <div className="grid gap-4.5 lg:grid-cols-[1fr_340px]">
      <div className="grid gap-4.5">
        <Card padded>
          <CardTitle>Add a CV</CardTitle>
          <form ref={formRef} action={uploadAction} className="grid gap-4">
            <UploadBox
              accept={ACCEPTED_RESUME_MIME}
              acceptExtensions={ACCEPTED_RESUME_EXTENSIONS}
              maxBytes={MAX_RESUME_BYTES}
              name="file"
              inputRef={fileRef}
              onFile={(file) => setChosen(file.name)}
              hint={chosen ? `Selected: ${chosen}` : undefined}
            />

            <div className="grid gap-2.5 sm:grid-cols-[1fr_auto]">
              <Input name="label" placeholder="Name it, e.g. Finance CV (optional)" />
              <Button type="submit" loading={uploading} disabled={!chosen}>
                Upload
              </Button>
            </div>

            {uploadState.error && (
              <p role="alert" className="m-0 text-xs font-semibold text-danger">
                {uploadState.error}
              </p>
            )}
            {uploadState.uploaded && (
              <p role="status" className="m-0 text-xs font-semibold text-mint-ink">
                Uploaded.
              </p>
            )}
          </form>

          <Suggestion>
            Your CV is stored privately. An employer can only open it once you have applied to one
            of their roles, and the link they get expires within minutes.
          </Suggestion>
        </Card>

        <Card padded>
          <CardTitle>Your CVs</CardTitle>
          {resumes.length === 0 ? (
            <EmptyState
              glyph="▤"
              title="No CV yet"
              body="Upload one and it will be offered whenever you apply. You can keep several and choose per application."
            />
          ) : (
            <ul className="grid list-none gap-2.5 p-0">
              {resumes.map((resume) => (
                <li
                  key={resume.id}
                  className="rounded-[12px] border border-line p-3.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <b className="text-sm">{resume.label}</b>
                        {resume.isPrimary && <Badge tone="mint">Primary</Badge>}
                        {!resume.hasText && (
                          <Badge tone="warn">No readable text</Badge>
                        )}
                      </div>
                      <span className="block text-xs text-muted">
                        {resume.fileName} · {resume.sizeLabel} · {resume.uploadedLabel}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="soft"
                      disabled={busy}
                      onClick={() => download(resume.id)}
                    >
                      Download
                    </Button>
                    {!resume.isPrimary && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          act(() => setPrimaryAction(resume.id), 'Set as your primary CV')
                        }
                      >
                        Make primary
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        const label = prompt('Name this CV', resume.label)
                        if (label !== null) act(() => renameResumeAction(resume.id, label), 'Renamed')
                      }}
                    >
                      Rename
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        if (!confirm(`Remove ${resume.label}? Applications you already sent keep their copy.`)) return
                        act(() => deleteResumeAction(resume.id), 'CV removed')
                      }}
                    >
                      Remove
                    </Button>
                  </div>

                  {!resume.hasText && (
                    <p className="m-0 mt-2.5 text-xs leading-relaxed text-muted">
                      We could not read any text from this file — it is probably a scan. It still
                      attaches to applications, but AI review needs readable text.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid content-start gap-4.5">
        <Card padded>
          <CardTitle>AI CV review</CardTitle>
          <p className="m-0 mb-4 text-[13px] leading-relaxed text-muted">
            Suggestions for presenting what you have done more clearly. It will not invent
            experience you have not listed — if something is missing it says so.
          </p>

          <Button
            type="button"
            className="w-full"
            loading={reviewing}
            disabled={resumes.length === 0}
            onClick={() => startReview(async () => setReview(await reviewCvAction()))}
          >
            {review.review ? 'Review again' : 'Review my CV'}
          </Button>

          {resumes.length === 0 && (
            <p className="m-0 mt-2.5 text-xs text-muted">Upload a CV first.</p>
          )}

          {review.error && (
            <p role="alert" className="mt-3 mb-0 text-xs font-semibold text-danger">
              {review.error}
            </p>
          )}

          {review.review && (
            <AiPanel
              className="mt-4"
              providerLabel={review.providerLabel}
              usedFallback={review.usedFallback}
            >
              <p className="m-0 text-[13px] leading-relaxed">{review.review.summary}</p>
              {review.review.suggestions.length > 0 && (
                <ul className="mt-3 grid list-none gap-2 p-0">
                  {review.review.suggestions.map((s, i) => (
                    <li key={i} className="rounded-[10px] border border-line bg-surface p-3">
                      <b className="block text-xs text-navy">{s.area}</b>
                      <span className="mt-1 block text-[13px] leading-relaxed text-muted">
                        {s.suggestion}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </AiPanel>
          )}
        </Card>
      </div>
    </div>
  )
}
