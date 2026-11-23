import { describe, expect, it } from 'vitest'
import { fallbackBeerDescription } from '@/lib/seo/beer-description'

describe('fallbackBeerDescription', () => {
  it('names ABV, style and hops', () => {
    expect(
      fallbackBeerDescription({
        name: 'Bearded Dragon',
        abv: 8,
        style: 'Ultra Hopped Ale',
        hops: 'Citra, Mosaic, Nelson Sauvin',
      }),
    ).toBe(
      'Bearded Dragon is an 8% Ultra Hopped Ale brewed by Lolev Beer in Pittsburgh, hopped with Citra, Mosaic and Nelson Sauvin.',
    )
  })

  it('picks the article from the spoken number', () => {
    expect(fallbackBeerDescription({ name: 'A', abv: 6.5, style: 'IPA' })).toContain('is a 6.5% IPA')
    expect(fallbackBeerDescription({ name: 'A', abv: 11, style: 'Stout' })).toContain('is an 11% Stout')
    expect(fallbackBeerDescription({ name: 'A', abv: 4.2, style: 'Pilsner' })).toContain('is a 4.2% Pilsner')
  })

  it('drops missing facts without leaving gaps', () => {
    expect(fallbackBeerDescription({ name: 'Monarch', style: 'Dry Hopped Pilsner' })).toBe(
      'Monarch is a Dry Hopped Pilsner brewed by Lolev Beer in Pittsburgh.',
    )
    expect(fallbackBeerDescription({ name: 'Mystery', style: 'Beer', hops: ' , ' })).toBe(
      'Mystery is a beer brewed by Lolev Beer in Pittsburgh.',
    )
    expect(fallbackBeerDescription({ name: 'X', style: 'IPA' })).toBe(
      'X is an IPA brewed by Lolev Beer in Pittsburgh.',
    )
  })

  it('names at most three hops', () => {
    expect(
      fallbackBeerDescription({ name: 'Big', abv: 7, style: 'IPA', hops: 'A, B, C, D, E' }),
    ).toBe('Big is a 7% IPA brewed by Lolev Beer in Pittsburgh, hopped with A, B, C and more.')
  })

  it('rounds ABV to one decimal', () => {
    expect(fallbackBeerDescription({ name: 'R', abv: 6.849999, style: 'IPA' })).toContain('6.8%')
  })
})
