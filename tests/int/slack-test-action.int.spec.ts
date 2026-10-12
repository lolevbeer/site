/**
 * "Send test message" under Admin → Site Content → Slack Channels: admins
 * only, posts to the typed channel (or the form's live fallback when blank or
 * invalid), and reports which channel it tried.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.fn()
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ auth })) }))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('@payload-config', () => ({ default: {} }))

const slackApi = vi.fn()
vi.mock('@/src/utils/slack-api', () => ({
  slackApi: (...args: unknown[]) => slackApi(...args),
}))

import { sendSlackTestMessage } from '@/src/actions/slack-test'

const admin = { id: 'a', roles: ['admin'] }

beforeEach(() => {
  auth.mockReset()
  slackApi.mockReset()
  slackApi.mockResolvedValue(true)
  delete process.env.SLACK_EVENT_INQUIRY_CHANNEL
  delete process.env.SLACK_DONATION_CHANNEL
})

describe('sendSlackTestMessage', () => {
  it('rejects non-admins without posting', async () => {
    auth.mockResolvedValue({ user: { id: 'e', roles: ['event-manager'] } })
    expect(await sendSlackTestMessage('eventInquiries', '#events')).toEqual({
      ok: false,
      channel: null,
    })
    expect(slackApi).not.toHaveBeenCalled()
  })

  it('posts to the typed channel', async () => {
    auth.mockResolvedValue({ user: admin })
    expect(await sendSlackTestMessage('eventInquiries', ' #private-events ')).toEqual({
      ok: true,
      channel: '#private-events',
    })
    expect(slackApi).toHaveBeenCalledWith(
      'chat.postMessage',
      expect.objectContaining({ channel: '#private-events' }),
    )
  })

  it('falls back to the live channel when blank or a DM id', async () => {
    auth.mockResolvedValue({ user: admin })
    process.env.SLACK_EVENT_INQUIRY_CHANNEL = '#inquiries'
    expect((await sendSlackTestMessage('eventInquiries', '')).channel).toBe('#inquiries')
    expect((await sendSlackTestMessage('eventInquiries', 'D0123456789')).channel).toBe('#inquiries')
    expect((await sendSlackTestMessage('jobs', '')).channel).toBe('#events')
  })

  it('reports a Slack failure', async () => {
    auth.mockResolvedValue({ user: admin })
    slackApi.mockResolvedValue(false)
    expect(await sendSlackTestMessage('donations', '#nope')).toEqual({
      ok: false,
      channel: '#nope',
    })
  })
})
