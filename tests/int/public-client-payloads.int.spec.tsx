/**
 * Server-to-client payload projections (R34). /food and the homepage used to
 * hand whole Payload docs to client components, so every hydration shipped
 * media `sizes` objects, populated locations, SEO groups and review data the
 * UI never reads. These tests pin two things:
 * - the projected props render exactly what the full docs render, and
 * - the serialized props shrink (sizes are logged for the PR description).
 */
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FeaturedBeers, FeaturedCans } from '@/components/home/featured-menu'
import { FoodPageClient } from '@/src/app/(frontend)/food/food-page-client'
import {
  toFoodPageSchedules,
  toHomeBeer,
  toHomeMenu,
} from '@/lib/utils/public-client-payloads'
import { DayOfWeek, type FoodVendorSchedule } from '@/lib/types/food'
import type { Beer, Media, Menu } from '@/src/payload-types'

vi.stubGlobal(
  'IntersectionObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)
vi.mock('@/components/location/location-provider', () => ({
  useLocationContext: () => ({
    currentLocation: 'lawrenceville',
    locations: [{ id: 'loc-1', slug: 'lawrenceville', name: 'Lawrenceville', active: true }],
    cycleLocation: () => {},
  }),
}))
vi.mock('@/lib/hooks/use-auth', () => ({
  useAuth: () => ({ isAuthenticated: false }),
}))
vi.mock('@/components/ui/page-breadcrumbs', () => ({ PageBreadcrumbs: () => null }))

afterEach(cleanup)

const bytes = (value: unknown) => JSON.stringify(value).length

/** A Media doc shaped like a Vercel Blob upload with all three derivatives. */
function media(name: string): Media {
  const size = (suffix: string, width: number) => ({
    url: `https://blob.example.com/media/${name}-${suffix}.png`,
    width,
    height: width,
    mimeType: 'image/png',
    filesize: 123456,
    filename: `${name}-${suffix}.png`,
  })
  return {
    id: `media-${name}`,
    alt: `${name} can`,
    prefix: 'media',
    _objectKey: `media/${name}.png`,
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    url: `https://blob.example.com/media/${name}.png`,
    thumbnailURL: `https://blob.example.com/media/${name}-thumbnail.png`,
    filename: `${name}.png`,
    mimeType: 'image/png',
    filesize: 2345678,
    width: 2000,
    height: 2000,
    focalX: 50,
    focalY: 50,
    sizes: { thumbnail: size('thumbnail', 300), card: size('card', 800), detail: size('detail', 1600) },
  }
}

function beer(slug: string, index: number): Beer {
  return {
    id: `beer-${slug}`,
    name: `Beer ${slug}`,
    slug,
    style: { id: 'style-1', name: 'Hazy IPA', updatedAt: 'x', createdAt: 'x' },
    glass: 'teku',
    abv: 6.5 + index / 10,
    description: 'A long tasting description that the compact homepage cards never show. '.repeat(3),
    hops: 'Citra, Mosaic, Nelson',
    draftPrice: 8,
    halfPour: 5,
    halfPourOnly: false,
    fourPack: 18,
    bottlePrice: index % 2 ? 22 : null,
    canSingle: 5,
    upc: '012345678905',
    image: media(slug),
    labelBase: media(`${slug}-label`),
    labelVideo: media(`${slug}-sprite`),
    untappd: `https://untappd.com/b/${slug}`,
    untappdRating: 4.1,
    untappdRatingCount: 1200,
    topBeerDrops: index % 2 ? `https://topbeerdrops.com/${slug}` : null,
    hideFromSite: index === 3,
    collab: index === 1,
    collabBrewery: index === 1 ? 'Friends Brewing' : null,
    recipe: 100 + index,
    positiveReviews: { highlights: ['juicy', 'soft', 'bright'], count: 42 },
    seo: { title: `Beer ${slug}`, description: 'SEO copy', keywords: ['ipa', 'hazy'] },
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: index === 0 ? new Date().toISOString() : '2020-01-01T00:00:00.000Z',
    _status: 'published',
  }
}

function menu(type: 'draft' | 'cans'): Menu {
  return {
    id: `${type}-menu`,
    name: `Lawrenceville ${type}`,
    description: 'Internal menu notes',
    type,
    url: `lawrenceville-${type}`,
    themeMode: 'dark',
    location: {
      id: 'loc-1',
      name: 'Lawrenceville',
      slug: 'lawrenceville',
      active: true,
      timezone: 'America/New_York',
      linesLastCleaned: '2026-01-01T00:00:00.000Z',
      intro: 'A long location intro paragraph. '.repeat(5),
      draftMenu: 'draft-menu',
      cansMenu: 'cans-menu',
      updatedAt: 'x',
      createdAt: 'x',
    },
    items: [
      ...['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'].map((slug, index) => ({
        id: `item-${slug}`,
        product: { relationTo: 'beers' as const, value: beer(slug, index) },
        price: index === 2 ? '$7' : null,
        promotion: index === 4 ? '2 for $30' : null,
      })),
      {
        id: 'item-cider',
        product: {
          relationTo: 'products' as const,
          value: {
            id: 'cider',
            name: 'House Cider',
            description: 'Dry cider',
            category: 'cocktails-cider' as const,
            options: ['Dry', 'Semi-sweet'],
            abv: 5.5,
            price: '7',
            guestTap: true,
            collab: false,
            updatedAt: 'x',
            createdAt: '2020-01-01T00:00:00.000Z',
          },
        },
      },
      { id: 'item-empty', product: null },
    ],
    updatedAt: 'x',
    createdAt: 'x',
    _status: 'published',
  } as Menu
}

describe('homepage menu projection', () => {
  it('renders the draft and cans sections identically to the full docs', () => {
    for (const [Section, type] of [
      [FeaturedBeers, 'draft'],
      [FeaturedCans, 'cans'],
    ] as const) {
      const full = render(createElement(Section, { menus: [menu(type)] })).container.innerHTML
      cleanup()
      const projected = render(createElement(Section, { menus: [toHomeMenu(menu(type))] }))
        .container.innerHTML
      cleanup()
      expect(projected).toBe(full)
      expect(full).toContain('Beer alpha')
    }
  })

  it('keeps one display URL per image size the homepage reads, and nothing else', () => {
    const projected = toHomeBeer(beer('alpha', 0))
    expect(projected.image).toEqual({
      url: 'https://blob.example.com/media/alpha.png',
      sizes: {
        thumbnail: { url: 'https://blob.example.com/media/alpha-thumbnail.png' },
        card: { url: 'https://blob.example.com/media/alpha-card.png' },
      },
    })
    for (const key of ['description', 'hops', 'labelVideo', 'labelBase', 'seo', 'positiveReviews', 'upc']) {
      expect(projected).not.toHaveProperty(key)
    }
  })

  it('shrinks the serialized menus', () => {
    const full = [menu('draft'), menu('cans')]
    const projected = full.map(toHomeMenu)
    console.info(`[R34] homepage menus: ${bytes(full)} B -> ${bytes(projected)} B`)
    expect(bytes(projected)).toBeLessThan(bytes(full) / 3)
  })
})

describe('/food client projection', () => {
  const schedules: FoodVendorSchedule[] = Array.from({ length: 40 }, (_, index) => ({
    vendor: `Vendor ${index}`,
    date: `2099-0${(index % 9) + 1}-1${index % 10}`,
    time: index % 4 === 1 ? '4-9pm' : '',
    start: index % 4 === 1 ? '' : '5pm',
    finish: '',
    site: index % 3 ? `https://vendor${index}.example.com` : undefined,
    logoUrl: `/api/media/file/vendor-${index}-thumbnail.png`,
    day: DayOfWeek.FRIDAY,
    dayNumber: 5,
    location: index % 2 ? 'lawrenceville' : 'zelienople',
    locationName: index % 2 ? 'Lawrenceville' : 'Zelienople',
    specialEvent: false,
  }))

  it('keeps only the rendered fields, folding start into time', () => {
    const [first] = toFoodPageSchedules(schedules)
    expect(first).toEqual({
      vendor: 'Vendor 0',
      date: '2099-01-10',
      time: '5pm',
      logoUrl: '/api/media/file/vendor-0-thumbnail.png',
      location: 'zelienople',
    })
  })

  it('renders the schedule identically to the full rows and shrinks the payload', () => {
    const projectedSchedules = toFoodPageSchedules(schedules)
    // The pre-R34 client rendered `time || start`; fold that in for the baseline.
    const asBefore = schedules.map((row) => ({ ...row, time: row.time || row.start }))
    const full = render(createElement(FoodPageClient, { initialSchedules: asBefore })).container
      .innerHTML
    cleanup()
    const projected = render(createElement(FoodPageClient, { initialSchedules: projectedSchedules }))
      .container
    // Lawrenceville rows only; row 1 has a time range, row 3 only a start time.
    expect(projected.innerHTML).toBe(full)
    expect(projected.textContent).toContain('Vendor 1')
    expect(projected.textContent).toContain('Vendor 3')
    expect(projected.textContent).not.toContain('Vendor 0')
    console.info(`[R34] /food schedules: ${bytes(schedules)} B -> ${bytes(projectedSchedules)} B`)
    expect(bytes(projectedSchedules)).toBeLessThan(bytes(schedules) * 0.7)
  })
})
