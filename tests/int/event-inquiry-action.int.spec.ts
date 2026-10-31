/**
 * Private-event inquiry action: honeypot does not write; success writes the
 * inbox row (never an Event), then pings Slack and emails events@ plus the
 * visitor in after(); exact retries, the
 * durable IP limit, and unknown taprooms do not write.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const afterFns: Array<() => Promise<void>> = []
const create = vi.fn()
const find = vi.fn()
const update = vi.fn()
const sendEmail = vi.fn()
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
  getPayload: vi.fn(async () => ({
    find,
    create,
    update,
    sendEmail,
    findGlobal: async () => ({}),
  })),
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
    startTime: '18:30',
    duration: '3h',
    drinks: 'guests-pay',
    companyPaid: 'no',
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
    sendEmail.mockReset()
    sendEmail.mockResolvedValue({ id: 'email-1' })
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
    const result = await submitEventInquiry({
      ...valid(),
      occasion: 'work',
      flexibleDate: true,
      otherDates: ['2026-11-21'],
    })
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
      otherDates: ['2026-11-21'],
      startTime: '18:30',
      duration: '3h',
      drinks: 'guests-pay',
      companyPaid: 'no',
    })
    expect(args.data.companyName).toBeUndefined()
    expect(args.data.foodPlan).toBeUndefined()
    expect(args.data.backupDate).toBeUndefined()
    const locationsRead = find.mock.calls.find(([a]) => a.collection === 'locations')
    expect(locationsRead?.[0]).toMatchObject({ overrideAccess: false })

    expect(afterFns).toHaveLength(2)
    await afterFns[0]()
    expect(slackApi).toHaveBeenCalledWith(
      'chat.postMessage',
      expect.objectContaining({ channel: '#events', unfurl_links: false }),
    )
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'event-inquiries', id: 'inq-1' }),
    )
  })

  it('emails events@ the full request and the visitor a receipt in after()', async () => {
    await submitEventInquiry({ ...valid(), message: 'Need the back room' })
    expect(afterFns).toHaveLength(2)
    await afterFns[1]()
    expect(sendEmail).toHaveBeenCalledTimes(2)
    const [team, receipt] = sendEmail.mock.calls.map(([message]) => message)
    expect(team).toMatchObject({ to: 'events@lolev.beer', replyTo: 'alex@example.org' })
    for (const detail of [
      'Alex Rivera',
      'alex@example.org',
      '412-555-0100',
      'Need the back room',
    ]) {
      expect(team.text).toContain(detail)
    }
    expect(receipt).toMatchObject({ to: 'alex@example.org', replyTo: 'events@lolev.beer' })
    expect(receipt.text).toContain('Lawrenceville')
    // Never echo visitor free text to an address the visitor typed in.
    expect(receipt.text).not.toContain('Need the back room')
    expect(receipt.html).not.toContain('Alex Rivera')
  })

  it('emails events@ every field on its own labeled line with the quote subject', async () => {
    await submitEventInquiry({
      ...valid(),
      occasion: 'work',
      backupDate: '2026-11-21',
      duration: '5h+',
      drinks: 'host-tab',
      companyPaid: 'yes',
      companyName: 'Acme Corp',
      foodPlan: 'food-truck',
      message: 'Need the back room',
    })
    await afterFns[1]()
    const team = sendEmail.mock.calls[0][0]
    expect(team.subject).toBe('Event inquiry: Alex Rivera, Work event, 2026-11-20, Lawrenceville')
    const lines = team.text.split('\n')
    for (const line of [
      'Name: Alex Rivera',
      'Email: alex@example.org',
      'Phone: 412-555-0100',
      'Event type: Work event',
      'Taproom: Lawrenceville',
      'Preferred date: 2026-11-20',
      'Backup date: 2026-11-21',
      'Other dates: —',
      'Start time: 6:30pm',
      'Length: 5+ hours',
      'Guests: 30',
      "Drinks: I'll run a host tab",
      'Company paying: Yes',
      'Company name: Acme Corp',
      'Food plan: Food truck',
      'Notes: Need the back room',
    ]) {
      expect(lines).toContain(line)
    }
  })

  it('stores the backup day at noon Eastern and the company name when a company pays', async () => {
    await submitEventInquiry({
      ...valid(),
      backupDate: '2026-11-21',
      companyPaid: 'yes',
      companyName: 'Acme Corp',
    })
    expect(create.mock.calls[0][0].data).toMatchObject({
      backupDate: '2026-11-21T17:00:00.000Z',
      companyPaid: 'yes',
      companyName: 'Acme Corp',
    })
  })

  it('still saves and answers ok when the events@ email throws', async () => {
    sendEmail.mockRejectedValue(new Error('resend down'))
    expect(await submitEventInquiry(valid())).toEqual({ ok: true })
    expect(create).toHaveBeenCalledTimes(1)
    await expect(afterFns[1]()).resolves.toBeUndefined()
  })

  it('escapes visitor text in the events@ HTML', async () => {
    await submitEventInquiry({ ...valid(), message: '<script>x</script>' })
    await afterFns[1]()
    expect(sendEmail.mock.calls[0][0].html).toContain('&lt;script&gt;')
  })

  it('still sends the receipt when the events@ email fails', async () => {
    sendEmail.mockRejectedValueOnce(new Error('resend down'))
    await submitEventInquiry(valid())
    await expect(afterFns[1]()).resolves.toBeUndefined()
    expect(sendEmail).toHaveBeenCalledTimes(2)
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
