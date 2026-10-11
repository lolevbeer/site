/** Private-event inquiry validation and the #events Slack summary. */
import { describe, expect, it } from 'vitest'
import { emptyEventInquiry, validateEventInquiry } from '@/lib/events/inquiry'
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
      ['email', 'headcount', 'name', 'phone', 'preferredDate', 'taproom'].sort(),
    )
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
