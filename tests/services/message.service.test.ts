import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionUser } from '@/lib/auth/session'

const findApplication = vi.fn()
const findConversationTx = vi.fn()
const createConversation = vi.fn()
const updateConversation = vi.fn()
const createMessage = vi.fn()
const findParticipant = vi.fn()
const findParticipants = vi.fn()
const updateParticipant = vi.fn()
const createNotification = vi.fn()
const findUser = vi.fn()

const tx = {
  application: { findFirst: findApplication },
  conversation: {
    findFirst: findConversationTx,
    create: createConversation,
    update: updateConversation,
  },
  message: { create: createMessage },
  conversationParticipant: {
    findFirst: findParticipant,
    findMany: findParticipants,
    updateMany: updateParticipant,
  },
  notification: { create: createNotification },
  user: { findUnique: findUser },
}

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
    conversationParticipant: { findFirst: findParticipant },
  },
}))

const { sendMessage, startConversation } = await import('@/server/services/message.service')

function user(role: SessionUser['role'], id = 'uid-emp'): SessionUser {
  return { id, email: 'a@b.com', name: 'A', avatarUrl: null, role, onboardedAt: new Date(), onboarded: true }
}

beforeEach(() => {
  for (const m of [
    findApplication,
    findConversationTx,
    createConversation,
    updateConversation,
    createMessage,
    findParticipant,
    findParticipants,
    updateParticipant,
    createNotification,
    findUser,
  ]) {
    m.mockReset()
  }

  findApplication.mockResolvedValue({
    id: 'app-1',
    job: { id: 'job-1', title: 'Accounts Officer' },
    candidateProfile: { userId: 'uid-cand' },
  })
  findConversationTx.mockResolvedValue(null)
  createConversation.mockResolvedValue({ id: 'conv-1' })
  createMessage.mockResolvedValue({ id: 'msg-1' })
  findParticipant.mockResolvedValue({ id: 'part-1', conversationId: 'conv-1' })
  // What the real query returns: everyone except the sender.
  findParticipants.mockResolvedValue([{ userId: 'uid-cand' }])
  createNotification.mockResolvedValue({ id: 'n-1' })
  findUser.mockResolvedValue({ id: 'uid-cand', name: 'Rafat', notifyOn: ['NEW_MESSAGE'] })
})

describe('startConversation', () => {
  it('creates a thread for an application to the caller company job', async () => {
    const result = await startConversation(user('EMPLOYER'), 'app-1')

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.conversationId).toBe('conv-1')
  })

  // Review Focus 2: cold outreach is not a feature. The employer's company must
  // own the job the application was sent to.
  it('scopes the application lookup to the caller own company', async () => {
    await startConversation(user('EMPLOYER'), 'app-1')

    expect(findApplication.mock.calls[0]?.[0]?.where).toMatchObject({
      id: 'app-1',
      job: { company: { employers: { some: { userId: 'uid-emp' } } } },
    })
  })

  it('refuses an application to another company job, creating nothing', async () => {
    findApplication.mockResolvedValue(null)

    const result = await startConversation(user('EMPLOYER'), 'someone-elses')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
    expect(createConversation).not.toHaveBeenCalled()
  })

  it('refuses a candidate, who cannot open a thread with an employer unprompted', async () => {
    const result = await startConversation(user('CANDIDATE', 'uid-cand'), 'app-1')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN')
    expect(findApplication).not.toHaveBeenCalled()
  })

  // One application, one thread. Two parallel threads about the same
  // application would split the conversation in half.
  it('reuses the existing thread rather than creating a second', async () => {
    findConversationTx.mockResolvedValue({ id: 'conv-existing' })

    const result = await startConversation(user('EMPLOYER'), 'app-1')

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.conversationId).toBe('conv-existing')
    expect(createConversation).not.toHaveBeenCalled()
  })

  it('adds both people as participants', async () => {
    await startConversation(user('EMPLOYER'), 'app-1')

    const participants = createConversation.mock.calls[0]?.[0]?.data?.participants?.create ?? []
    const ids = participants.map((p: { userId: string }) => p.userId)
    expect(ids).toContain('uid-emp')
    expect(ids).toContain('uid-cand')
  })
})

describe('sendMessage', () => {
  it('sends a message in a thread the caller belongs to', async () => {
    const result = await sendMessage(user('CANDIDATE', 'uid-cand'), 'conv-1', 'Hello')

    expect(result.ok).toBe(true)
    expect(createMessage.mock.calls[0]?.[0]?.data).toMatchObject({
      conversationId: 'conv-1',
      senderId: 'uid-cand',
      body: 'Hello',
    })
  })

  // Review Focus 1: a conversation id belonging to two other people.
  it('puts membership in the where clause, not a check after fetching', async () => {
    await sendMessage(user('CANDIDATE', 'uid-cand'), 'conv-1', 'Hello')

    expect(findParticipant.mock.calls[0]?.[0]?.where).toMatchObject({
      conversationId: 'conv-1',
      userId: 'uid-cand',
    })
  })

  it('refuses a non-participant and writes nothing', async () => {
    findParticipant.mockResolvedValue(null)

    const result = await sendMessage(user('CANDIDATE', 'a-stranger'), 'conv-1', 'Hello')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
    expect(createMessage).not.toHaveBeenCalled()
    expect(createNotification).not.toHaveBeenCalled()
  })

  it('refuses an empty message', async () => {
    const result = await sendMessage(user('CANDIDATE', 'uid-cand'), 'conv-1', '   ')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION')
    expect(createMessage).not.toHaveBeenCalled()
  })

  it('caps the message length', async () => {
    const result = await sendMessage(user('CANDIDATE', 'uid-cand'), 'conv-1', 'x'.repeat(5001))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION')
  })

  // Written in the same transaction, so a notification cannot exist for a
  // message that rolled back.
  it('notifies the other participant, not the sender', async () => {
    await sendMessage(user('EMPLOYER'), 'conv-1', 'Can you interview Tuesday?')

    // The exclusion is in the query, so the sender is never a candidate for
    // notification in the first place.
    expect(findParticipants.mock.calls[0]?.[0]?.where).toMatchObject({
      conversationId: 'conv-1',
      userId: { not: 'uid-emp' },
    })

    expect(createNotification).toHaveBeenCalledTimes(1)
    expect(createNotification.mock.calls[0]?.[0]?.data).toMatchObject({
      userId: 'uid-cand',
      type: 'NEW_MESSAGE',
    })
  })

  // Preferences are the person's, not a suggestion. A notification they asked
  // not to receive is spam with extra steps.
  it('respects a recipient who turned message notifications off', async () => {
    findUser.mockResolvedValue({ id: 'uid-cand', name: 'Rafat', notifyOn: ['APPLICATION_UPDATE'] })

    const result = await sendMessage(user('EMPLOYER'), 'conv-1', 'Hello')

    expect(result.ok).toBe(true)
    expect(createMessage).toHaveBeenCalled()
    expect(createNotification).not.toHaveBeenCalled()
  })

  it('bumps the thread so the list orders by recent activity', async () => {
    await sendMessage(user('EMPLOYER'), 'conv-1', 'Hello')

    expect(updateConversation.mock.calls[0]?.[0]?.where).toMatchObject({ id: 'conv-1' })
  })
})
