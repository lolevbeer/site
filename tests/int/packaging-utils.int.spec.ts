import { describe, it, expect } from 'vitest'
import {
  getPackagingType,
  getPackagingLabel,
  getNoPackagingLabel,
  getDraftOnlyMessage,
  getPackagingAtLocationsMessage,
  getPricingLines,
} from '@/lib/utils/packaging-utils'

describe('getPackagingType', () => {
  it('returns "cans" when beer has fourPack but no bottlePrice', () => {
    expect(getPackagingType({ fourPack: 15, bottlePrice: null })).toBe('cans')
  })

  it('returns "bottles" when beer has bottlePrice but no fourPack', () => {
    expect(getPackagingType({ fourPack: null, bottlePrice: 12 })).toBe('bottles')
  })

  it('returns "cans_and_bottles" when beer has both', () => {
    expect(getPackagingType({ fourPack: 15, bottlePrice: 12 })).toBe('cans_and_bottles')
  })

  it('returns "cans" as fallback when neither is set', () => {
    expect(getPackagingType({ fourPack: null, bottlePrice: null })).toBe('cans')
  })

  it('returns "cans" when fourPack is set and bottlePrice is undefined', () => {
    expect(getPackagingType({ fourPack: 15 })).toBe('cans')
  })

  it('returns "bottles" when bottlePrice is set and fourPack is undefined', () => {
    expect(getPackagingType({ bottlePrice: 12 })).toBe('bottles')
  })

  it('ignores zero values (treats as not set)', () => {
    expect(getPackagingType({ fourPack: 0, bottlePrice: 12 })).toBe('bottles')
    expect(getPackagingType({ fourPack: 15, bottlePrice: 0 })).toBe('cans')
  })
})

describe('getPackagingLabel', () => {
  it('returns correct labels', () => {
    expect(getPackagingLabel('cans')).toBe('Cans Available')
    expect(getPackagingLabel('bottles')).toBe('Bottles Available')
    expect(getPackagingLabel('cans_and_bottles')).toBe('Cans & Bottles Available')
  })
})

describe('getNoPackagingLabel', () => {
  it('returns correct labels', () => {
    expect(getNoPackagingLabel('cans')).toBe('No Cans')
    expect(getNoPackagingLabel('bottles')).toBe('No Bottles')
    expect(getNoPackagingLabel('cans_and_bottles')).toBe('No Cans or Bottles')
  })
})

describe('getDraftOnlyMessage', () => {
  it('returns correct messages', () => {
    expect(getDraftOnlyMessage('cans')).toContain('No cans available')
    expect(getDraftOnlyMessage('bottles')).toContain('No bottles available')
    expect(getDraftOnlyMessage('cans_and_bottles')).toContain('No cans or bottles available')
  })
})

describe('getPackagingAtLocationsMessage', () => {
  it('returns correct messages with locations', () => {
    expect(getPackagingAtLocationsMessage('cans', ['Lawrenceville'])).toBe(
      'Cans available at Lawrenceville',
    )
    expect(getPackagingAtLocationsMessage('bottles', ['Lawrenceville', 'Zelienople'])).toBe(
      'Bottles available at Lawrenceville and Zelienople',
    )
  })
})

describe('getPricingLines', () => {
  const beer = { draftPrice: 7, fourPack: 15, bottlePrice: 12 }

  it('lists draft on tap and packaged prices where cans are sold', () => {
    expect(getPricingLines(beer, { onTap: true, inCans: true })).toEqual([
      'Draft $7',
      '4 Pack $15',
      'Bottle $12',
    ])
  })

  it('formats cents like the rest of the site', () => {
    expect(
      getPricingLines(
        { draftPrice: 7.5, fourPack: 16, bottlePrice: null },
        { onTap: true, inCans: true },
      ),
    ).toEqual(['Draft $7.50', '4 Pack $16'])
  })

  it('leaves out prices for places the beer is not available', () => {
    expect(getPricingLines(beer, { onTap: true, inCans: false })).toEqual(['Draft $7'])
    expect(getPricingLines(beer, { onTap: false, inCans: true })).toEqual([
      '4 Pack $15',
      'Bottle $12',
    ])
  })

  it('treats a zero or missing price as not sold, never as a "0" line', () => {
    expect(
      getPricingLines(
        { draftPrice: 0, fourPack: null, bottlePrice: 0 },
        { onTap: true, inCans: true },
      ),
    ).toEqual([])
  })
})
