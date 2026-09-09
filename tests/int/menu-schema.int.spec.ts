import { describe, expect, it } from 'vitest'
import { generateLocationMenuSchema } from '@/lib/utils/menu-schema'

describe('generateLocationMenuSchema', () => {
  it('builds a per-taproom Menu with On Tap and Cans sections', () => {
    const schema = generateLocationMenuSchema({
      locationName: 'Lawrenceville',
      locationSlug: 'lawrenceville',
      draftBeers: [{ name: 'Lupula', abv: 7, draftPrice: 8, style: 'Hazy IPA' }],
      canBeers: [{ name: 'Akko', abv: 6, fourPack: 16, style: 'IPA' }],
    })
    expect(schema['@type']).toBe('Menu')
    expect(schema.name).toBe('Lolev Beer Lawrenceville Menu')
    expect(schema.url).toBe('https://lolev.beer/lawrenceville')
    expect(schema.hasMenuSection?.map((s) => s.name)).toEqual(['On Tap', 'Cans To-Go'])
    expect(schema.hasMenuSection?.[0].hasMenuItem[0].name).toBe('Lupula')
  })
})
