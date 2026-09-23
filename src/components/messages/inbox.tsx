'use client'

import { useState, useTransition } from 'react'
import { Badge, Button, Card, EmptyState, Textarea, useToast } from '@/components/ui'
import { Avatar } from '@/components/ui'
import { cn } from '@/lib/utils/cn'
import type {
  ConversationDetail,
  ConversationSummary,
} from '@/lib/db/repositories/message.repository'
import { openConversationAction, sendMessageAction } from '@/app/(candidate)/messages/actions'

/**
 * One inbox, used by both sides.
 *
 * A candidate and an employer see the same thing: the threads they are in. The
 * only asymmetry is who may start one, which the service decides — not this.
 *
 * `jobHrefPrefix` has no default on purpose. This used to link "View role" at
 * `/jobs/[id]`, which is the candidate group, so every employer who clicked it
 * was redirected to their dashboard with no explanation. A required prop makes
 * each page state where its own role may go, and the typechecker refuses a page
 * that forgets.
 *
 * A string rather than a function that builds the href. This is a client
 * component, so its props are serialised across the server boundary — and a
 * function does not serialise. Passing one failed the whole render, which in
 * production is a 500 and an error card with a digest instead of a reason.
 */
export function Inbox({
  conversations,
  initial,
  emptyBody,
  jobHrefPrefix,
}: {
  conversations: ConversationSummary[]
  initial: ConversationDetail | null
  emptyBody: string
  /** Where this side's "View role" goes, e.g. `/jobs` or `/manage-jobs`. */
  jobHrefPrefix: string
}) {
  const [open, setOpen] = useState<ConversationDetail | null>(initial)
  const [body, setBody] = useState('')
  const [pending, start] = useTransition()
  const { show } = useToast()

  function select(id: string) {
    start(async () => {
      const result = await openConversationAction(id)
      if (result.error || !result.conversation) {
        show(result.error ?? 'Could not open that conversation', 'error')
        return
      }
      setOpen(result.conversation)
    })
  }

  function send() {
    if (!open || !body.trim()) return

    start(async () => {
      const result = await sendMessageAction(open.id, body)
      if (result.error) {
        show(result.error, 'error')
        return
      }
      setBody('')
      const refreshed = await openConversationAction(open.id)
      if (refreshed.conversation) setOpen(refreshed.conversation)
    })
  }

  if (conversations.length === 0) {
    return (
      <Card>
        <EmptyState glyph="✉" title="No conversations yet" body={emptyBody} />
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <div className="grid lg:grid-cols-[310px_1fr]">
        <ul className="grid list-none gap-1 border-line p-3.5 lg:border-r">
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <button
                type="button"
                onClick={() => select(conversation.id)}
                aria-current={open?.id === conversation.id ? 'true' : undefined}
                className={cn(
                  'flex w-full items-start gap-2.5 rounded-xl p-3 text-left transition-colors',
                  open?.id === conversation.id ? 'bg-blue-wash' : 'hover:bg-bg',
                )}
              >
                <Avatar name={conversation.otherName} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <b className="truncate text-[13px]">{conversation.otherName}</b>
                    {conversation.unread && <Badge tone="blue">New</Badge>}
                  </div>
                  <span className="block truncate text-[11px] text-muted">
                    {conversation.subject}
                  </span>
                  {conversation.lastMessage && (
                    <span className="mt-0.5 block truncate text-[11px] text-muted">
                      {conversation.lastMessage}
                    </span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>

        <div className="flex min-h-[520px] flex-col">
          {!open ? (
            <EmptyState
              glyph="✉"
              title="Choose a conversation"
              body="Pick a thread on the left to read it."
            />
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
                <div className="min-w-0">
                  <b className="block truncate text-sm">{open.otherName}</b>
                  <span className="block truncate text-xs text-muted">{open.subject}</span>
                </div>
                {open.jobId && (
                  <Button href={`${jobHrefPrefix}/${open.jobId}`} variant="ghost" size="sm">
                    View role
                  </Button>
                )}
              </div>

              <div className="chat-scroll flex flex-1 flex-col gap-3.5 overflow-auto p-6">
                {open.messages.length === 0 ? (
                  <p className="m-0 text-center text-[13px] text-muted">
                    No messages yet. Say something.
                  </p>
                ) : (
                  open.messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        'max-w-[72%] rounded-[15px] px-3.5 py-3 text-[13px] leading-relaxed',
                        message.mine
                          ? 'self-end bg-blue text-white'
                          : 'self-start bg-[#eef2f8]',
                      )}
                    >
                      <p className="m-0 whitespace-pre-wrap">{message.body}</p>
                      <span
                        className={cn(
                          'mt-1 block text-[10px]',
                          message.mine ? 'text-white/70' : 'text-muted',
                        )}
                      >
                        {message.atLabel}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  send()
                }}
                className="flex gap-2.5 border-t border-line p-4"
              >
                <label htmlFor="message-body" className="sr-only">
                  Your message
                </label>
                <Textarea
                  id="message-body"
                  rows={2}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write a message…"
                  maxLength={5000}
                  className="flex-1"
                />
                <Button type="submit" loading={pending} disabled={!body.trim()}>
                  Send
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}
