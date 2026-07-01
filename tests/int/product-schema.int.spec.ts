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
