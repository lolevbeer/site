/** firstFieldError summarises a failed form for the alert above it. */
import { describe, expect, it } from 'vitest'
import { firstFieldError, PUBLIC_FORM_INCOMPLETE } from '@/lib/public-forms/fields'

describe('firstFieldError', () => {
  it('returns the only error as is', () => {
    expect(firstFieldError({ name: 'Enter your name.' })).toBe('Enter your name.')
  })

  it('says how many fields failed when more than one did', () => {
    expect(
      firstFieldError({ name: 'Enter your name.', email: 'Enter a valid email.', phone: undefined }),
    ).toBe('2 fields need fixing. Enter your name.')
  })

  it('falls back when there are no errors', () => {
    expect(firstFieldError({})).toBe(PUBLIC_FORM_INCOMPLETE)
  })
})
