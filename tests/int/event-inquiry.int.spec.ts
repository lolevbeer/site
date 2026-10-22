/** Private-event inquiry validation and the #events Slack summary. */
import { describe, expect, it } from 'vitest'
import {
  EVENT_INQUIRY_MAX_HEADCOUNT,
  EVENT_INQUIRY_MAX_TEXT,
  emptyEventInquiry,
  validateEventInquiry,
} from '@/lib/events/inquiry'
import { FORMULA_PREFIX_ERROR } from '@/lib/public-forms/fields'
import { buildEventInquirySlackMessage } from '@/lib/events/inquiry-slack'

const TODAY = '2026-10-11'
const TAPROOMS = ['lawrenceville', 'zelienople']

function valid() {
  return {
    ...emptyEventInquiry(),
    name: 'Alex Rivera',
    email: 'alex@example.org',
    phone: '412-555-0100',
    preferredDate: '2026-11-20',
    headcount: 30,
    taproom: 'lawrenceville',
    message: 'Retirement party, would love the back room.',
  }
}

describe('validateEventInquiry', () => {
  it('accepts a complete inquiry and trims it', () => {
    const result = validateEventInquiry({ ...valid(), name: '  Alex Rivera ' }, TODAY, TAPROOMS)
    expect(result).toMatchObject({
      ok: true,
      spam: false,
      value: { name: 'Alex Rivera', headcount: 30 },
    })
  })

  it('treats a filled honeypot as silent spam', () => {
    expect(validateEventInquiry({ ...valid(), companyUrlHp: 'x' }, TODAY, TAPROOMS)).toEqual({
      ok: true,
      spam: true,
    })
  })

  it('flags each bad field', () => {
    const result = validateEventInquiry(
      { ...emptyEventInquiry(), preferredDate: '2026-10-01', headcount: 0, taproom: 'nowhere' },
      TODAY,
      TAPROOMS,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(Object.keys(result.errors).sort()).toEqual(
      ['email', 'headcount', 'name', 'preferredDate', 'taproom'].sort(),
    )
  })

  it('treats phone as optional but rejects a malformed one', () => {
    expect(validateEventInquiry({ ...valid(), phone: '  ' }, TODAY, TAPROOMS)).toMatchObject({
      ok: true,
      value: { phone: '' },
    })
    expect(validateEventInquiry({ ...valid(), phone: '123' }, TODAY, TAPROOMS)).toMatchObject({
      ok: false,
      errors: { phone: 'Enter a full phone number or leave it blank.' },
    })
  })

  it('names the past-date and invalid-date errors separately', () => {
    const past = validateEventInquiry({ ...valid(), preferredDate: '2026-10-10' }, TODAY, TAPROOMS)
    expect(past).toMatchObject({
      ok: false,
      errors: { preferredDate: 'Pick a date in the future.' },
    })
    const bad = validateEventInquiry({ ...valid(), preferredDate: '2026-02-30' }, TODAY, TAPROOMS)
    expect(bad).toMatchObject({ ok: false, errors: { preferredDate: 'Enter a preferred date.' } })
  })

  it('accepts today and up to two years out, and rejects later dates', () => {
    expect(validateEventInquiry({ ...valid(), preferredDate: TODAY }, TODAY, TAPROOMS).ok).toBe(
      true,
    )
    expect(
      validateEventInquiry({ ...valid(), preferredDate: '2028-10-11' }, TODAY, TAPROOMS).ok,
    ).toBe(true)
    expect(
      validateEventInquiry({ ...valid(), preferredDate: '2028-10-12' }, TODAY, TAPROOMS),
    ).toMatchObject({ ok: false, errors: { preferredDate: 'Pick a date within two years.' } })
    expect(
      validateEventInquiry({ ...valid(), preferredDate: '9999-12-31' }, TODAY, TAPROOMS).ok,
    ).toBe(false)
  })

  it.each([[EVENT_INQUIRY_MAX_HEADCOUNT + 1], [2.5], [true], ['abc'], ['1e2'], [' ']])(
    'rejects headcount %j',
    (headcount) => {
      expect(validateEventInquiry({ ...valid(), headcount }, TODAY, TAPROOMS)).toMatchObject({
        ok: false,
        errors: { headcount: 'Enter how many guests.' },
      })
    },
  )

  it('accepts a digit-string headcount from a form post', () => {
    expect(validateEventInquiry({ ...valid(), headcount: '30' }, TODAY, TAPROOMS)).toMatchObject({
      ok: true,
      value: { headcount: 30 },
    })
  })

  it('rejects a too-long name or message', () => {
    expect(
      validateEventInquiry({ ...valid(), name: 'a'.repeat(201) }, TODAY, TAPROOMS),
    ).toMatchObject({ ok: false, errors: { name: 'That answer is too long.' } })
    expect(
      validateEventInquiry(
        { ...valid(), message: 'a'.repeat(EVENT_INQUIRY_MAX_TEXT + 1) },
        TODAY,
        TAPROOMS,
      ),
    ).toMatchObject({ ok: false, errors: { message: 'That answer is too long.' } })
  })

  it('rejects a formula-prefixed email and lowercases a good one', () => {
    expect(validateEventInquiry({ ...valid(), email: '=cmd@x.co' }, TODAY, TAPROOMS)).toMatchObject(
      { ok: false, errors: { email: FORMULA_PREFIX_ERROR } },
    )
    expect(
      validateEventInquiry({ ...valid(), email: 'Alex@Example.org' }, TODAY, TAPROOMS),
    ).toMatchObject({ ok: true, value: { email: 'alex@example.org' } })
  })

  it('allows an empty message but rejects a formula prefix', () => {
    expect(validateEventInquiry({ ...valid(), message: '' }, TODAY, TAPROOMS).ok).toBe(true)
    const result = validateEventInquiry({ ...valid(), message: '=HYPERLINK()' }, TODAY, TAPROOMS)
    expect(result.ok).toBe(false)
  })

  it('returns a field error for a non-object', () => {
    expect(validateEventInquiry(null, TODAY, TAPROOMS).ok).toBe(false)
  })
})

describe('buildEventInquirySlackMessage', () => {
  it('names the taproom, date, and headcount but keeps contact details out', () => {
    const message = buildEventInquirySlackMessage({
      preferredDate: '2026-11-20',
      headcount: 30,
      taproomName: 'Lawrenceville',
    })
    const body = JSON.stringify(message)
    expect(body).toContain('Lawrenceville')
    expect(body).toContain('2026-11-20')
    expect(body).toContain('30')
    expect(body).not.toContain('alex@example.org')
  })
})
