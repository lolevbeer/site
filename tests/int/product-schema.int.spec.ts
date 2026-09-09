import { describe, it, expect } from 'vitest'
import { generateProductSchema } from '@/lib/utils/product-schema'

// Guards the SEO fixes: Product.image must resolve to a REAL absolute URL
// (not a hardcoded .webp path that doesn't exist), and priced offers must
// carry priceValidUntil so Google doesn't warn on the rich result.
describe('generateProductSchema image resolution', () => {
  it('uses the local PNG (image: true) as an absolute URL, not a .webp', () => {
    const schema = generateProductSchema({ name: 'Akko', slug: 'akko', image: true } as any)
    expect(schema.image).toBe('https://lolev.beer/images/beer/akko.png')
    expect(schema.image).not.toContain('.webp')
  })

  it('makes a relative Payload/Blob URL absolute', () => {
    const schema = generateProductSchema({
      name: 'Alma',
      slug: 'alma',
      image: { url: '/api/media/file/alma.png' },
    } as any)
    expect(schema.image).toBe('https://lolev.beer/api/media/file/alma.png')
  })

  it('omits image when there is none', () => {
    const schema = generateProductSchema({ name: 'Nope', slug: 'nope', image: null } as any)
    expect(schema.image).toBeUndefined()
  })

  it('adds priceValidUntil to a priced offer', () => {
    const schema = generateProductSchema({ name: 'Array', slug: 'array', draftPrice: 7 } as any)
    const offers = Array.isArray(schema.offers) ? schema.offers : [schema.offers]
    expect(offers[0]?.priceValidUntil).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('generateProductSchema offers and reviews', () => {
  it('names draft vs 4-pack offers and does not default them to InStock', () => {
    const schema = generateProductSchema({
      name: 'Lupula',
      slug: 'lupula',
      draftPrice: 8,
      fourPack: 19,
    } as any)
    const offers = Array.isArray(schema.offers) ? schema.offers : [schema.offers]
    expect(offers.map((o) => o?.name)).toEqual(['Draft pour', '4-pack'])
    expect(offers.every((o) => o?.availability === 'https://schema.org/InStock')).toBe(false)
  })

  it('marks offers InStock only when the beer is on a current menu', () => {
    const schema = generateProductSchema(
      { name: 'Lupula', slug: 'lupula', draftPrice: 8 } as any,
      { inStock: true },
    )
    const offers = Array.isArray(schema.offers) ? schema.offers : [schema.offers]
    expect(offers[0]?.availability).toBe('https://schema.org/InStock')
  })

  it('keeps Untappd aggregateRating without embedding a mismatched Review array', () => {
    const schema = generateProductSchema({
      name: 'Lupula',
      slug: 'lupula',
      untappdRating: 4.07,
      untappdRatingCount: 1600,
      positiveReviews: [
        { username: 'sam', rating: 4, text: 'Great', date: '2026-01-01' },
      ],
    } as any)
    expect(schema.aggregateRating?.reviewCount).toBe('1600')
    expect(schema.review).toBeUndefined()
  })
})

describe('generateBeerListSchema', () => {
  it('emits ItemList of beer URLs instead of 146 nested Products', async () => {
    const { generateBeerListSchema } = await import('@/lib/utils/product-schema')
    const schema = generateBeerListSchema([
      { name: 'Lupula', slug: 'lupula', draftPrice: 8 } as any,
      { name: 'Akko', slug: 'akko', draftPrice: 7 } as any,
    ])
    expect(schema.numberOfItems).toBe(2)
    expect(schema.itemListElement[0]).toMatchObject({
      '@type': 'ListItem',
      position: 1,
      url: 'https://lolev.beer/beer/lupula',
      name: 'Lupula',
    })
    expect(schema.itemListElement[0]).not.toHaveProperty('item')
  })
})

