/**
 * Donation-request gates: 30-day lead time, required ringer copy, honeypot.
 */
import { describe, expect, it } from 'vitest'
import {
  DONATION_LEAD_DAYS,
  DONATION_MAX_TEXT,
  emptyDonationRequest,
  minimumEventDate,
  page1Gates,
  validateDonationRequest,
  type DonationRequestInput,
} from '@/lib/donate/donation-request'
import { buildDonationSlackMessage, donationSlackChannel } from '@/lib/donate/slack-message'

const TODAY = '2026-09-09'

function validInput(overrides: Partial<DonationRequestInput> = {}): DonationRequestInput {
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
    previousDonation: 'no',
    askType: 'product',
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
    ...overrides,
  }
}

describe('page1Gates', () => {
  it('names taprooms from Payload instead of a hardcoded pair', () => {
    const nearby = page1Gates([{ name: 'North Side' }, { name: 'South Side' }]).find(
      (gate) => gate.key === 'nearbyOk',
    )
    expect(nearby?.label).toBe(
      'The venue is a reasonable drive from our North Side and South Side taprooms.',
    )
  })
})

describe('minimumEventDate', () => {
  it(`is ${DONATION_LEAD_DAYS} calendar days after today`, () => {
    expect(minimumEventDate(TODAY)).toBe('2026-10-09')
  })
})

describe('validateDonationRequest', () => {
  it('accepts a complete product request on the minimum date', () => {
    const result = validateDonationRequest(validInput(), TODAY)
    expect(result).toMatchObject({ ok: true, spam: false })
    if (result.ok && !result.spam) {
      expect(result.value.askType).toBe('product')
      expect(result.value.previousDonation).toBe('no')
      expect(result.value.attendees).toBe(120)
    }
  })

  it('rejects an event sooner than 30 days even if the checkbox is ticked', () => {
    const result = validateDonationRequest(validInput({ eventDate: '2026-10-08' }), TODAY)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.eventDate).toMatch(/30 days/)
  })

  it('rejects when a page-1 gate is unchecked', () => {
    const result = validateDonationRequest(validInput({ twentyOnePlus: false }), TODAY)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.twentyOnePlus).toBe('Required')
  })

  it('requires a taproom when the ask is a fundraiser night', () => {
    const result = validateDonationRequest(
      validInput({
        askType: 'taproom-night',
        taproom: '',
        pickupName: '',
        howServed: '',
      }),
      TODAY,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.taproom).toBe('Choose a taproom.')
  })

  it('rejects a megabyte-scale field', () => {
    const result = validateDonationRequest(
      validInput({ mission: 'x'.repeat(DONATION_MAX_TEXT + 1) }),
      TODAY,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.mission).toMatch(/too long/)
  })

  it('treats a filled honeypot as silent spam, not a validation error', () => {
    expect(validateDonationRequest(validInput({ companyUrlHp: 'https://spam.test' }), TODAY)).toEqual({
      ok: true,
      spam: true,
    })
  })

  it('treats a non-string honeypot as spam', () => {
    expect(validateDonationRequest({ ...validInput(), companyUrlHp: ['x'] }, TODAY)).toEqual({
      ok: true,
      spam: true,
    })
  })

  it('rejects a non-object payload without throwing', () => {
    const result = validateDonationRequest(null, TODAY)
    expect(result.ok).toBe(false)
  })

  it('rejects a calendar-invalid date that matches YYYY-MM-DD', () => {
    const result = validateDonationRequest(validInput({ eventDate: '2026-13-40' }), TODAY)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.eventDate).toMatch(/date/)
  })

  it('rejects a fractional attendance', () => {
    const result = validateDonationRequest(validInput({ attendees: 1.5 }), TODAY)
    expect(result.ok).toBe(false)
  })

  it('rejects a formula-prefixed org name', () => {
    const result = validateDonationRequest(validInput({ organizationName: '=cmd' }), TODAY)
    expect(result.ok).toBe(false)
  })

  it('rejects a taproom that is not in the allowlist', () => {
    const result = validateDonationRequest(
      validInput({
        askType: 'taproom-night',
        taproom: 'made-up',
        howServed: '',
        pickupName: '',
      }),
      TODAY,
      ['lawrenceville', 'zelienople'],
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.taproom).toBe('Choose a taproom.')
  })
})

describe('donation Slack ping', () => {
  it('defaults to #events and names the org in the fallback text', () => {
    expect(donationSlackChannel()).toBe('#events')
    const validated = validateDonationRequest(validInput(), TODAY)
    if (!validated.ok || validated.spam) throw new Error('expected a valid request')
    const message = buildDonationSlackMessage(validated.value)
    expect(message.text).toContain('Lawrenceville Firefighters Association')
    expect(message.text).toContain('Product pickup')
  })

  it('escapes mention markup in the fallback text', () => {
    const validated = validateDonationRequest(
      validInput({ organizationName: 'Friends of <!channel>' }),
      TODAY,
    )
    if (!validated.ok || validated.spam) throw new Error('expected a valid request')
    const message = buildDonationSlackMessage(validated.value)
    expect(message.text).toContain('&lt;!channel&gt;')
    expect(message.text).not.toContain('<!channel>')
    expect(JSON.stringify(message.blocks)).not.toContain('alex@example.org')
  })
})
