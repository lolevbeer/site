/**
 * Address text for distributors. `formatFullAddress` builds the geocoder query and
 * `formatAddress` builds the popup / Directions text. Both append the country name
 * for a non-US venue so "47 High Street, Penge" cannot resolve to the wrong country;
 * US output must stay byte-identical to what it was before the country field existed.
 */
import { describe, expect, it } from 'vitest'
import { formatFullAddress } from '@/lib/distributors/import-patch'
import { formatAddress } from '@/lib/utils/formatters'

const us = { address: '123 Main St', city: 'Pittsburgh', state: 'PA', zip: '15201' }

describe('formatFullAddress', () => {
  it('leaves a US address unchanged, with or without an explicit US country', () => {
    expect(formatFullAddress(us)).toBe('123 Main St, Pittsburgh PA 15201')
    expect(formatFullAddress({ ...us, country: 'US' })).toBe('123 Main St, Pittsburgh PA 15201')
    expect(formatFullAddress({ ...us, country: null })).toBe('123 Main St, Pittsburgh PA 15201')
  })

  it('appends the country name outside the US', () => {
    expect(
      formatFullAddress({
        address: 'Nieuwezijds Voorburgwal 250',
        city: 'Amsterdam',
        state: 'Noord-Holland',
        country: 'NL',
      }),
    ).toBe('Nieuwezijds Voorburgwal 250, Amsterdam Noord-Holland, Netherlands')
  })

  it('omits missing parts but still names the country', () => {
    expect(formatFullAddress({ address: '47 High Street', country: 'GB' })).toBe(
      '47 High Street, United Kingdom',
    )
  })
})

describe('formatAddress', () => {
  it('leaves a US address unchanged, with or without an explicit US country', () => {
    expect(formatAddress(us)).toBe('123 Main St, Pittsburgh, PA 15201')
    expect(formatAddress({ ...us, country: 'US' })).toBe('123 Main St, Pittsburgh, PA 15201')
    expect(formatAddress({ ...us, country: null })).toBe('123 Main St, Pittsburgh, PA 15201')
  })

  it('appends the country name outside the US', () => {
    expect(formatAddress({ address: '47 High Street', city: 'Penge', country: 'GB' })).toBe(
      '47 High Street, Penge, United Kingdom',
    )
  })

  it('omits missing parts but still names the country', () => {
    expect(formatAddress({ address: '3-4-13 Takadanobaba', country: 'JP' })).toBe(
      '3-4-13 Takadanobaba, Japan',
    )
  })
})
