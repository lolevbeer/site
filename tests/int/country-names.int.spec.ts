/**
 * English country names for address text. Lives in lib/utils so the shared address
 * formatter does not depend on the distributors module.
 */
import { describe, expect, it } from 'vitest'
import { countryName, countrySuffix } from '@/lib/utils/country-names'

describe('countryName', () => {
  it('gives the English name', () => {
    expect(countryName('NL')).toBe('Netherlands')
    expect(countryName('JP')).toBe('Japan')
  })
})

describe('countrySuffix', () => {
  it('is empty for a blank or US country, and the name otherwise', () => {
    expect(countrySuffix(null)).toBe('')
    expect(countrySuffix('US')).toBe('')
    expect(countrySuffix('GB')).toBe('United Kingdom')
  })
})
