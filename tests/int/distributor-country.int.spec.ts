/**
 * Country helpers for distributors: ISO-3166-1 alpha-2 validation, display names,
 * and the grouping key that keeps a US state apart from a country with the same code.
 */
import { describe, expect, it } from 'vitest'
import { effectiveCountry, groupKey, isCountryCode } from '@/lib/distributors/country'

describe('isCountryCode', () => {
  it('accepts uppercase ISO-2 codes', () => {
    for (const code of ['NL', 'JP', 'GB', 'US', 'DE']) expect(isCountryCode(code)).toBe(true)
  })

  it('rejects unassigned codes, lowercase, names, and blanks', () => {
    for (const bad of ['ZZ', 'nl', 'USA', 'Netherlands', 'N', '']) {
      expect(isCountryCode(bad)).toBe(false)
    }
  })

  it('rejects codes Intl names but that are not countries, and keeps Kosovo', () => {
    for (const bad of ['EU', 'UN', 'QO', 'XA', 'EZ', 'AC']) expect(isCountryCode(bad)).toBe(false)
    expect(isCountryCode('XK')).toBe(true)
  })
})

describe('groupKey', () => {
  it('treats a blank or US country as a US state, so existing rows keep their group', () => {
    expect(groupKey({ region: 'DE' })).toBe('US:DE')
    expect(groupKey({ country: 'US', region: 'DE' })).toBe('US:DE')
    expect(groupKey({ country: null, region: 'PA' })).toBe('US:PA')
  })

  it('keeps Germany apart from Delaware, and Canada apart from California', () => {
    expect(groupKey({ country: 'DE' })).toBe('DE')
    expect(groupKey({ country: 'CA' })).toBe('CA')
    expect(groupKey({ country: 'DE' })).not.toBe(groupKey({ region: 'DE' }))
    expect(groupKey({ country: 'CA' })).not.toBe(groupKey({ region: 'CA' }))
  })
})

describe('effectiveCountry', () => {
  it('uses the country cell when set', () => {
    expect(effectiveCountry({ country: 'NL', state: 'PA' })).toBe('NL')
  })

  it('reads a blank country with a US state or region as US', () => {
    expect(effectiveCountry({ state: 'PA' })).toBe('US')
    expect(effectiveCountry({ region: 'VA' })).toBe('US')
  })

  it('is unknown for a blank country with a non-US or missing state', () => {
    expect(effectiveCountry({ state: 'Noord-Holland' })).toBeUndefined()
    expect(effectiveCountry({})).toBeUndefined()
  })
})
