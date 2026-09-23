import { describe, expect, it } from 'vitest'
import { SIGNED_URL_TTL_SECONDS } from '@/lib/supabase/storage'

/**
 * A signed URL is a bearer token for the most sensitive file on the platform —
 * a CV, with a full name, a phone number and often an address. The bucket is
 * private and nothing serves a file directly, so the link is the only way in,
 * and its whole defence is that it stops working quickly: one pasted into a chat
 * or left in a browser history should be useless within minutes.
 *
 * In its own file because the service tests mock the storage module.
 */
describe('the signed CV link', () => {
  it('expires in minutes, not hours', () => {
    expect(SIGNED_URL_TTL_SECONDS).toBeGreaterThan(30)
    expect(SIGNED_URL_TTL_SECONDS).toBeLessThanOrEqual(300)
  })
})
