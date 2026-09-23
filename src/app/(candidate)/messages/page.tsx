import type { Metadata } from 'next'
import { requireGroup } from '@/lib/auth/require-group'
import { PageHead } from '@/components/layout'
import { Inbox } from '@/components/messages/inbox'
import {
  findConversation,
  listConversations,
} from '@/lib/db/repositories/message.repository'

export const metadata: Metadata = { title: 'Messages — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function MessagesPage() {
  const user = await requireGroup('candidate')
  const conversations = await listConversations(user.id)

  // Opens on the most recent thread, so the page is useful without a click.
  const first = conversations[0]
  const initial = first ? await findConversation(user.id, first.id) : null

  return (
    <>
      <PageHead
        title="Messages"
        description="Conversations with employers about roles you applied to."
      />
      <Inbox
        jobHrefFor={(id) => `/jobs/${id}`}
        conversations={conversations}
        initial={initial}
        emptyBody="When an employer gets in touch about one of your applications, the conversation appears here."
      />
    </>
  )
}
