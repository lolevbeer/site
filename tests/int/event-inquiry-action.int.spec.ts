/**
 * Private-event inquiry action: honeypot does not write; success writes the
 * inbox row (never an Event) and pings Slack in after(); exact retries, the
 * durable IP limit, and unknown taprooms do not write.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const afterFns: Array<() => Promise<void>> = []
const create = vi.fn()
const find = vi.fn()
const update = vi.fn()
const slackApi = vi.fn()
const reserveIpHashSlot = vi.fn()

vi.mock('next/server', () => ({
  after: (fn: () => Promise<void>) => {
    afterFns.push(fn)
  },
}))
vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (name: string) => (name === 'x-forwarded-for' ? '203.0.113.10' : null),
  }),
}))
vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({ find, create, update, findGlobal: async () => ({}) })),
}))
vi.mock('@/src/payload.config', () => ({ default: {} }))
vi.mock('@/lib/public-forms/durable-limit', () => ({
  reserveIpHashSlot: (...args: unknown[]) => reserveIpHashSlot(...args),
}))
vi.mock('@/src/utils/slack-api', () => ({
  slackApi: (...args: unknown[]) => slackApi(...args),
}))
vi.mock('@/lib/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))
vi.mock('@/lib/config/server-env', () => ({
  readServerEnvironment: () => ({ payloadSecret: 'test-secret' }),
}))

import { submitEventInquiry } from '@/src/actions/event-inquiry'
import { emptyEventInquiry } from '@/lib/events/inquiry'
import { PUBLIC_FORM_IP_LIMIT_MESSAGE } from '@/lib/public-forms/rate-limit'
import { getDateEST } from '@/lib/utils/date'

function valid() {
  return {
    ...emptyEventInquiry(),
    name: 'Alex Rivera',
    email: 'alex@example.org',
    phone: '412-555-0100',
    preferredDate: '2026-11-20',
    headcount: 30,
    taproom: 'lawrenceville',
    message: '',
  }
}

const TODAY = '2026-10-11'

describe('submitEventInquiry', () => {
  // Pin the clock so the fixture date stays inside the accepted window.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(`${TODAY}T12:00:00-04:00`))
  })
  afterEach(() => vi.useRealTimers())

  beforeEach(() => {
    afterFns.length = 0
    create.mockReset()
    find.mockReset()
    update.mockReset()
    slackApi.mockReset()
    reserveIpHashSlot.mockReset()
    reserveIpHashSlot.mockResolvedValue(async () => {})
    find.mockImplementation(async (args: { collection: string }) => {
      if (args.collection === 'locations') {
        return { docs: [{ id: 'loc-1', slug: 'lawrenceville', name: 'Lawrenceville' }] }
      }
      return { docs: [] }
    })
    create.mockResolvedValue({ id: 'inq-1' })
    update.mockResolvedValue({})
    slackApi.mockResolvedValue(true)
  })

  it('does not create a row when the honeypot is filled', async () => {
    const result = await submitEventInquiry({ ...valid(), companyUrlHp: 'https://spam.test' })
    expect(result).toEqual({ ok: true })
    expect(create).not.toHaveBeenCalled()
    expect(afterFns).toHaveLength(0)
  })

  it('returns field errors without writing', async () => {
    const result = await submitEventInquiry({ ...valid(), email: 'nope' })
    expect(result).toMatchObject({ ok: false, errors: { email: expect.any(String) } })
    expect(create).not.toHaveBeenCalled()
  })

  it('stores the inquiry with the taproom ID, then posts Slack in after()', async () => {
    const result = await submitEventInquiry({ ...valid(), occasion: 'work', flexibleDate: true })
    expect(result).toEqual({ ok: true })
    expect(create).toHaveBeenCalledTimes(1)
    const args = create.mock.calls[0][0]
    expect(args.collection).toBe('event-inquiries')
    expect(args.overrideAccess).toBe(true)
    expect(args.data).toMatchObject({
      taproom: 'loc-1',
      headcount: 30,
      status: 'new',
      occasion: 'work',
      flexibleDate: true,
    })
    const locationsRead = find.mock.calls.find(([a]) => a.collection === 'locations')
    expect(locationsRead?.[0]).toMatchObject({ overrideAccess: false })

    expect(afterFns).toHaveLength(1)
    await afterFns[0]()
    expect(slackApi).toHaveBeenCalledWith(
      'chat.postMessage',
      expect.objectContaining({ channel: '#events', unfurl_links: false }),
    )
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'event-inquiries', id: 'inq-1' }),
    )
  })

  it('stores the preferred day at noon Eastern so dayOnly pickers show the same day', async () => {
    await submitEventInquiry(valid())
    const stored = create.mock.calls[0][0].data.preferredDate
    expect(stored).toBe('2026-11-20T17:00:00.000Z')
    expect(getDateEST(new Date(stored))).toBe('2026-11-20')
  })

  it('acknowledges an exact retry by submissionKey without writing', async () => {
    find.mockImplementation(async (args: { collection: string; where?: unknown }) => {
      if (args.collection === 'locations') {
        return { docs: [{ id: 'loc-1', slug: 'lawrenceville', name: 'Lawrenceville' }] }
      }
      if (JSON.stringify(args.where).includes('submissionKey')) return { docs: [{ id: 'old' }] }
      return { docs: [] }
    })
    const result = await submitEventInquiry({ ...valid(), email: 'Alex@Example.org' })
    expect(result).toEqual({ ok: true })
    expect(create).not.toHaveBeenCalled()
    expect(afterFns).toHaveLength(0)
  })

  it('stores a submissionKey and ipHash with the row', async () => {
    await submitEventInquiry(valid())
    expect(create.mock.calls[0][0].data).toMatchObject({
      submissionKey: expect.stringMatching(/^[0-9a-f]{64}$/),
      ipHash: expect.any(String),
    })
    expect(reserveIpHashSlot).toHaveBeenCalledWith(
      expect.anything(),
      'event-inquiries',
      expect.any(String),
    )
  })

  it('refuses when no durable ipHash slot is free', async () => {
    reserveIpHashSlot.mockResolvedValue(null)
    const result = await submitEventInquiry(valid())
    expect(result).toMatchObject({ ok: false, error: PUBLIC_FORM_IP_LIMIT_MESSAGE })
    expect(create).not.toHaveBeenCalled()
  })

  it('rejects a taproom that is not an active location', async () => {
    const result = await submitEventInquiry({ ...valid(), taproom: 'zelienople' })
    expect(result).toMatchObject({ ok: false, errors: { taproom: 'Choose a taproom.' } })
    expect(create).not.toHaveBeenCalled()
  })

  it('returns ok false for a non-object without throwing', async () => {
    const result = await submitEventInquiry(null)
    expect(result.ok).toBe(false)
    expect(create).not.toHaveBeenCalled()
  })
})
