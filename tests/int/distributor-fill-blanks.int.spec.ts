/**
 * `fillBlankParts` fills only the blank city, state, country and zip of a distributor
 * row from the geocoder's answer. A cell the CSV supplied is never changed, and the
 * `inferred` list names exactly what was filled so the import report can show it.
 */
import { describe, expect, it } from 'vitest'
import { fillBlankParts } from '@/lib/distributors/fill-blank-parts'

describe('fillBlankParts', () => {
  it('fills blank city, state and country from the resolved parts', () => {
    const { filled, inferred } = fillBlankParts(
      { address: '47 High Street' },
      { city: 'London', state: 'England', country: 'GB' },
    )
    expect(filled).toEqual({ city: 'London', state: 'England', country: 'GB' })
    expect(inferred).toEqual(['city', 'state', 'country'])
  })

  it('never changes a cell the row supplied', () => {
    const { filled, inferred } = fillBlankParts(
      { city: 'Penge', state: '東京都', country: 'JP', zip: '160-0023' },
      { city: 'Shinjuku', state: 'Tokyo', country: 'JP', zip: '169-0075' },
    )
    expect(filled).toEqual({})
    expect(inferred).toEqual([])
  })

  it('treats empty and whitespace-only cells as blank', () => {
    const { filled } = fillBlankParts(
      { city: '  ', state: '', country: null },
      { city: 'Tampere', state: 'Pirkanmaa', country: 'FI' },
    )
    expect(filled).toEqual({ city: 'Tampere', state: 'Pirkanmaa', country: 'FI' })
  })

  it('fills only the blanks and lists only those', () => {
    const { filled, inferred } = fillBlankParts(
      { city: 'Amsterdam', country: 'NL' },
      { city: 'Amsterdam', state: 'North Holland', country: 'NL', zip: '1012 RR' },
    )
    expect(filled).toEqual({ state: 'North Holland', zip: '1012 RR' })
    expect(inferred).toEqual(['state', 'zip'])
  })

  it('ignores resolved parts the geocoder did not return', () => {
    const { filled, inferred } = fillBlankParts({}, { country: 'GB' })
    expect(filled).toEqual({ country: 'GB' })
    expect(inferred).toEqual(['country'])
  })

  it('turns a US state name into its code and sets the region', () => {
    const { filled, inferred } = fillBlankParts(
      { address: '1 Main' },
      { city: 'Pittsburgh', state: 'Pennsylvania', country: 'US', zip: '15201' },
    )
    expect(filled).toEqual({
      city: 'Pittsburgh',
      state: 'PA',
      country: 'US',
      zip: '15201',
      region: 'PA',
    })
    expect(inferred).toEqual(['city', 'state', 'country', 'zip'])
  })

  it('maps the District of Columbia', () => {
    const { filled } = fillBlankParts({}, { state: 'District of Columbia', country: 'US' })
    expect(filled).toMatchObject({ state: 'DC', region: 'DC' })
  })

  it('does not guess a US state code when the name is not a state', () => {
    const { filled } = fillBlankParts({}, { state: 'Puerto Rico', country: 'US' })
    expect(filled.state).toBeUndefined()
    expect(filled.region).toBeUndefined()
    expect(filled.country).toBe('US')
  })

  it('leaves a supplied US state alone and sets only the missing region', () => {
    const { filled, inferred } = fillBlankParts(
      { state: 'PA', country: 'US' },
      { state: 'Pennsylvania', country: 'US' },
    )
    expect(filled).toEqual({ region: 'PA' })
    expect(inferred).toEqual([])
  })

  it('leaves a non-US row with no region', () => {
    const { filled } = fillBlankParts({}, { city: 'Berlin', state: 'Berlin', country: 'DE' })
    expect(filled.region).toBeUndefined()
    expect(filled).toMatchObject({ city: 'Berlin', state: 'Berlin', country: 'DE' })
  })

  it('uses the row country, not the resolved one, to decide the row is US', () => {
    const { filled } = fillBlankParts({ country: 'US' }, { state: 'Pennsylvania', country: 'US' })
    expect(filled).toMatchObject({ state: 'PA', region: 'PA' })
  })
})
