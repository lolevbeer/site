/**
 * Homepage client-boundary view models: exact shape, no Payload metadata.
 */
import { describe, expect, it } from 'vitest'
import { projectComingSoon, projectHeroBeers, projectMarketingBeers } from '@/lib/utils/homepage-view-models'

const beer = {
  id: 'b1',
  slug: 'hades',
  name: 'Hades',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  collection: 'beers',
  image: {
    url: '/api/media/file/hades.png',
    sizes: { thumbnail: { url: '/api/media/file/hades-thumb.webp' } },
  },
  style: { name: 'IPA' },
  abv: 6.5,
}

describe('projectHeroBeers', () => {
  it('returns only id, slug, name, and thumbnail imageUrl for cans-menu beers', () => {
    const menus = [
      {
        items: [{ product: { relationTo: 'beers', value: beer } }],
      },
    ]
    const projected = projectHeroBeers([beer], menus)
    expect(projected).toEqual([
      {
        id: 'b1',
        slug: 'hades',
        name: 'Hades',
        imageUrl: '/api/media/file/hades-thumb.webp',
      },
    ])
    expect(projected[0]).not.toHaveProperty('createdAt')
    expect(projected[0]).not.toHaveProperty('updatedAt')
    expect(projected[0]).not.toHaveProperty('collection')
  })

  it('omits beers that are not in a cans menu', () => {
    expect(projectHeroBeers([beer], [{ items: [] }])).toEqual([])
  })
})

describe('projectMarketingBeers', () => {
  it('projects name, type, and abv without Payload metadata', () => {
    const menu = {
      items: [{ product: { relationTo: 'beers', value: beer } }],
    }
    const projected = projectMarketingBeers(menu)
    expect(projected).toEqual([{ variant: 'hades', name: 'Hades', type: 'IPA', abv: 6.5 }])
    expect(projected[0]).not.toHaveProperty('createdAt')
  })
})

describe('projectComingSoon', () => {
  it('keeps name, slug, style name, and hideFromSite only', () => {
    const projected = projectComingSoon([
      {
        beer: { ...beer, hideFromSite: false },
        style: { name: 'Lager' },
      },
    ])
    expect(projected).toEqual([
      {
        name: 'Hades',
        slug: 'hades',
        styleName: 'IPA',
        hideFromSite: false,
      },
    ])
  })
})
