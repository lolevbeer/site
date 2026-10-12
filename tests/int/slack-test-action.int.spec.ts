/**
 * "Send test message" under Admin → Site Content → Slack Channels: admins
 * only, posts to the typed channel (or the form's live fallback when blank),
 * rejects values the field validator would reject, and says why it failed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.fn()
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ auth })) }))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('@payload-config', () => ({ default: {} }))

const slackApi = vi.fn()
vi.mock('@/src/utils/slack-api', () => ({
  slackApi: (...args: unknown[]) => slackApi(...args),
}))

const env = { slackBotToken: 'xoxb-test' as string | undefined }
vi.mock('@/lib/config/server-env', () => ({ readServerEnvironment: () => env }))

import { sendSlackTestMessage, type SlackTestForm } from '@/src/actions/slack-test'

const admin = { id: 'a', roles: ['admin'] }
const SLACK_ENV = ['SLACK_EVENT_INQUIRY_CHANNEL', 'SLACK_DONATION_CHANNEL', 'SLACK_JOBS_CHANNEL']
const saved = Object.fromEntries(SLACK_ENV.map((key) => [key, process.env[key]]))

beforeEach(() => {
  auth.mockReset()
  auth.mockResolvedValue({ user: admin })
  slackApi.mockReset()
  slackApi.mockResolvedValue(true)
  env.slackBotToken = 'xoxb-test'
  for (const key of SLACK_ENV) delete process.env[key]
})

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('sendSlackTestMessage', () => {
  it('rejects anonymous callers, non-admins, and unknown forms without posting', async () => {
    auth.mockResolvedValueOnce({ user: null })
    expect(await sendSlackTestMessage('eventInquiries', '#events')).toEqual({
      ok: false,
      reason: 'forbidden',
    })
    auth.mockResolvedValueOnce({ user: { id: 'e', roles: ['event-manager'] } })
    expect((await sendSlackTestMessage('eventInquiries', '#events')).ok).toBe(false)
    expect((await sendSlackTestMessage('toString' as SlackTestForm, '#events')).ok).toBe(false)
    expect(slackApi).not.toHaveBeenCalled()
  })

  it('posts to the typed channel', async () => {
    expect(await sendSlackTestMessage('eventInquiries', ' #private-events ')).toEqual({
      ok: true,
      channel: '#private-events',
    })
    expect(slackApi).toHaveBeenCalledWith(
      'chat.postMessage',
      expect.objectContaining({ channel: '#private-events' }),
    )
  })

  it('tests the live fallback channel when the field is blank', async () => {
    process.env.SLACK_EVENT_INQUIRY_CHANNEL = '#inquiries'
    expect((await sendSlackTestMessage('eventInquiries', '')).channel).toBe('#inquiries')
    expect((await sendSlackTestMessage('jobs', '')).channel).toBe('#events')
  })

  it('rejects a value the field would not save instead of swapping in a default', async () => {
    for (const bad of ['private-events', 'D0123456789', '#bad name']) {
      expect(await sendSlackTestMessage('eventInquiries', bad)).toEqual({
        ok: false,
        reason: 'invalid',
      })
    }
    expect(slackApi).not.toHaveBeenCalled()
  })

  it('says Slack is not configured instead of blaming the channel', async () => {
    env.slackBotToken = undefined
    expect(await sendSlackTestMessage('donations', '#donations')).toEqual({
      ok: false,
      reason: 'not-configured',
    })
    expect(slackApi).not.toHaveBeenCalled()
  })

  it('reports a Slack refusal with the channel it tried', async () => {
    slackApi.mockResolvedValue(false)
    expect(await sendSlackTestMessage('donations', '#nope')).toEqual({
      ok: false,
      reason: 'refused',
      channel: '#nope',
    })
  })
})
