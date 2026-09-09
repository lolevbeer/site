/**
 * Public donate action: honeypot does not write; success writes then Slack after().
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const afterFns: Array<() => Promise<void>> = []
const create = vi.fn()
const find = vi.fn()
const update = vi.fn()
const slackApi = vi.fn()

vi.mock('next/server', () => ({
  after: (fn: () => Promise<void>) => {
    afterFns.push(fn)
  },
}))

vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (name: string) => (name === 'x-forwarded-for' ? '203.0.113.9' : null),
  }),
}))

vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({ find, create, update })),
}))

vi.mock('@/src/payload.config', () => ({ default: {} }))

vi.mock('@/src/utils/slack-api', () => ({
  slackApi: (...args: unknown[]) => slackApi(...args),
}))

vi.mock('@/lib/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

vi.mock('@/lib/config/server-env', () => ({
  readServerEnvironment: () => ({ payloadSecret: 'test-secret' }),
}))

import { submitDonationRequest } from '@/src/actions/donation-request'
import { emptyDonationRequest, minimumEventDate } from '@/lib/donate/donation-request'
import { resetPublicFormRateLimit } from '@/lib/public-forms/rate-limit'

const TODAY = '2026-09-09'

function valid() {
  return {
    ...emptyDonationRequest(),
    isFundraiser: true,
    leadTimeOk: true,
    nearbyOk: true,
    twentyOnePlus: true,
    notExcludedCategory: true,
    pickupOrOnSite: true,
    understandsNotAYes: true,
    organizationName: 'Lawrenceville Firefighters Association',
    contactName: 'Alex Rivera',
    email: 'alex@example.org',
    phone: '412-555-0100',
    mission:
      'We raise money for gear, scholarships, and neighborhood safety programs in Lawrenceville and the surrounding river wards every year.',
    howHeard: 'We drink at the Butler Street taproom after shifts.',
    previousDonation: 'no' as const,
    askType: 'product' as const,
    eventName: 'Annual pancake breakfast',
    eventDate: minimumEventDate(TODAY),
    venue: 'Firehouse, 15th Street, Pittsburgh',
    attendees: 120,
    requestDetails: 'Two cases of cans for a 21+ after-party in the hall next door.',
    howServed: 'Cans, served by our 21+ volunteers, not sold to minors.',
    recognition: 'Logo on the poster, a thank-you from the mic, and a story on our Facebook.',
    whyLolev:
      'Half the hall already drinks Lolev and we want the beer to be from the neighborhood, not a distributor one-off.',
    pickupName: 'Alex Rivera, 34, pickup truck',
    certify: true,
  }
}

describe('submitDonationRequest', () => {
  beforeEach(() => {
    afterFns.length = 0
    create.mockReset()
    find.mockReset()
    update.mockReset()
    slackApi.mockReset()
    resetPublicFormRateLimit()
    find.mockImplementation(async (args: { collection: string }) => {
      if (args.collection === 'locations') {
        return { docs: [{ slug: 'lawrenceville', active: true }] }
      }
      return { docs: [] }
    })
    create.mockResolvedValue({ id: 'req-1' })
    update.mockResolvedValue({})
    slackApi.mockResolvedValue(true)
  })

  it('does not create a row when the honeypot is filled', async () => {
    const result = await submitDonationRequest({ ...valid(), companyUrlHp: 'https://spam.test' })
    expect(result).toEqual({ ok: true })
    expect(create).not.toHaveBeenCalled()
    expect(afterFns).toHaveLength(0)
  })

  it('creates a row then posts Slack in after()', async () => {
    const result = await submitDonationRequest(valid())
    expect(result).toEqual({ ok: true })
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][0].collection).toBe('donation-requests')
    expect(afterFns).toHaveLength(1)
    await afterFns[0]()
    expect(slackApi).toHaveBeenCalledWith(
      'chat.postMessage',
      expect.objectContaining({ unfurl_links: false, unfurl_media: false }),
    )
  })

  it('returns ok false for a non-object without throwing', async () => {
    const result = await submitDonationRequest(null)
    expect(result.ok).toBe(false)
    expect(create).not.toHaveBeenCalled()
  })
})
