/**
 * Public-form Slack pings post to the channel set in Admin → Site Content →
 * Slack Channels when one is set, else the env/default channel the caller
 * passes. An invalid admin value (a typo, a user id) is ignored so PII never
 * lands in a DM.
 */
import type { Payload } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const slackApi = vi.fn()
vi.mock('@/src/utils/slack-api', () => ({
  slackApi: (...args: unknown[]) => slackApi(...args),
}))

import { notifyCollectionOnSlack } from '@/lib/slack/notify'

function fakePayload(slackChannels: Record<string, string | null> | undefined) {
  return {
    findGlobal: vi.fn().mockResolvedValue({ slackChannels }),
    update: vi.fn().mockResolvedValue({}),
  } as unknown as Payload & { findGlobal: ReturnType<typeof vi.fn> }
}

const message = { text: 't', blocks: [] }

async function postedChannel(
  collection: 'donation-requests' | 'job-applications' | 'event-inquiries',
  slackChannels: Record<string, string | null> | undefined,
) {
  await notifyCollectionOnSlack(fakePayload(slackChannels), {
    collection,
    id: '1',
    channel: '#env-channel',
    message,
    failLog: 'x',
  })
  return slackApi.mock.calls[0][1].channel
}

beforeEach(() => {
  slackApi.mockReset()
  slackApi.mockResolvedValue({ ok: true })
})

describe('notifyCollectionOnSlack channel', () => {
  it('uses the Admin channel for each form', async () => {
    const set = { donations: '#donations', jobs: '#hiring', eventInquiries: 'C0123456789' }
    expect(await postedChannel('donation-requests', set)).toBe('#donations')
    slackApi.mockClear()
    expect(await postedChannel('job-applications', set)).toBe('#hiring')
    slackApi.mockClear()
    expect(await postedChannel('event-inquiries', set)).toBe('C0123456789')
  })

  it('falls back to the passed channel when Admin is blank or invalid', async () => {
    expect(await postedChannel('donation-requests', undefined)).toBe('#env-channel')
    slackApi.mockClear()
    expect(await postedChannel('job-applications', { jobs: '' })).toBe('#env-channel')
    slackApi.mockClear()
    expect(await postedChannel('event-inquiries', { eventInquiries: 'U0123456789' })).toBe(
      '#env-channel',
    )
  })

  it('still pings the passed channel if the settings read fails', async () => {
    const payload = fakePayload(undefined)
    payload.findGlobal.mockRejectedValueOnce(new Error('db down'))
    await notifyCollectionOnSlack(payload, {
      collection: 'donation-requests',
      id: '1',
      channel: '#env-channel',
      message,
      failLog: 'x',
    })
    expect(slackApi.mock.calls[0][1].channel).toBe('#env-channel')
  })
})
