/**
 * Job apply validation: required fields, honeypot, length cap.
 */
import { describe, expect, it } from 'vitest'
import { emptyJobApplication, validateJobApplication } from '@/lib/jobs/application'

function valid() {
  return {
    ...emptyJobApplication('bartender'),
    name: 'Alex Rivera',
    email: 'alex@example.com',
    phone: '412-555-0100',
    message: 'I have poured at two taprooms and want to work nights on Butler Street.',
  }
}

describe('validateJobApplication', () => {
  it('accepts a complete application', () => {
    expect(validateJobApplication(valid())).toEqual({ ok: true, spam: false })
  })

  it('rejects a short note', () => {
    const result = validateJobApplication({ ...valid(), message: 'Hi' })
    expect(result.ok).toBe(false)
  })

  it('treats a filled honeypot as silent spam', () => {
    expect(validateJobApplication({ ...valid(), companyUrlHp: 'https://spam.test' })).toEqual({
      ok: true,
      spam: true,
    })
  })

  it('rejects a non-object payload without throwing', () => {
    expect(validateJobApplication(null).ok).toBe(false)
  })
})
