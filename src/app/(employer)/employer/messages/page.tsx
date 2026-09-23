import type { Metadata } from 'next'
import { requireGroup } from '@/lib/auth/require-group'
import { PageHead } from '@/components/layout'
import { Button } from '@/components/ui'
import { Inbox } from '@/components/messages/inbox'
import {
  findConversation,
  listConversations,
} from '@/lib/db/repositories/message.repository'

export const metadata: Metadata = { title: 'Messages — CareerMate' }
export const dynamic = 'force-dynamic'

export default async function EmployerMessagesPage() {
  const user = await requireGroup('employer')
  const conversations = await listConversations(user.id)

  const first = conversations[0]
  const initial = first ? await findConversation(user.id, first.id) : null

  return (
    <>
      <PageHead
        title="Messages"
        description="Conversations with people who applied to your roles."
        actions={
          <Button href="/candidates" variant="ghost">
            Review candidates
          </Button>
        }
      />
      <Inbox
        jobHrefFor={(id) => `/manage-jobs/${id}`}
        conversations={conversations}
        initial={initial}
        emptyBody="Open a conversation from a candidate's page. You can message anyone who has applied to one of your roles."
      />
    </>
  )
}
