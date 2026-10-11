/**
 * Tests beer detail page error handling by importing the real BeerPage component:
 * - notFound() is called for missing beers
 * - notFound() is called for hidden beers
 * - DB errors propagate to error.tsx (not caught)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Sentinel for notFound mock
class NotFoundSentinel extends Error {
  constructor() {
    super('notFound was called')
  }
}

// Mock next/navigation — throw sentinel so we can detect notFound() calls
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new NotFoundSentinel()
  }),
}))

// Mock child components to avoid rendering complexity
vi.mock('@/components/beer/beer-details', () => ({
  BeerDetails: () => null,
}))

vi.mock('@/components/seo/json-ld', () => ({
  JsonLd: () => null,
}))

vi.mock('@/components/motion', () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => children,
}))

// Mock payload-api
vi.mock('@/lib/utils/payload-api', () => ({
  getBeerBySlug: vi.fn(),
  getAllBeersFromPayload: vi.fn(),
  getAllLocations: vi.fn(async () => []),
  getDraftMenu: vi.fn(async () => null),
  getCansMenu: vi.fn(async () => null),
  fetchGlobal: vi.fn(),
}))

vi.mock('@/lib/utils/site-seo', () => ({
  getSiteSeo: vi.fn(async () => ({})),
}))

// Mock media-utils
vi.mock('@/lib/utils/media-utils', () => ({
  getBeerImageUrl: vi.fn((image) => (image ? '/mock-image-url' : null)),
  getMediaUrl: vi.fn(() => undefined),
}))

// Mock product-schema and breadcrumb-schema
vi.mock('@/lib/utils/product-schema', () => ({
  generateProductSchema: vi.fn(() => ({})),
}))

vi.mock('@/lib/utils/breadcrumb-schema', () => ({
  generateBreadcrumbSchema: vi.fn(() => ({})),
  generateWebPageSchema: vi.fn(() => ({})),
}))

// Import real page AFTER mocking dependencies
import BeerPage, { generateMetadata } from '@/src/app/(frontend)/beer/[variant]/page'
import { getAllLocations, getBeerBySlug, getCansMenu, getDraftMenu } from '@/lib/utils/payload-api'
import { generateProductSchema } from '@/lib/utils/product-schema'
import type { ReactElement } from 'react'

function mockedGetBeerBySlug() {
  return getBeerBySlug as ReturnType<typeof vi.fn>
}

const hiddenBeer = {
  id: 'beer-1',
  slug: 'hidden-beer',
  name: 'Hidden Beer',
  hideFromSite: true,
  glass: 'pint' as const,
  abv: 5.5,
  draftPrice: 7,
}

describe('BeerPage error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should throw NotFoundSentinel when beer slug does not exist', async () => {
    const getBeer = mockedGetBeerBySlug()
    getBeer.mockResolvedValue(null)

    await expect(BeerPage({ params: Promise.resolve({ variant: 'nonexistent' }) })).rejects.toThrow(
      NotFoundSentinel,
    )
    expect(getBeer).toHaveBeenCalledWith('nonexistent')
  })

  it('should throw NotFoundSentinel when beer is hidden from site', async () => {
    const getBeer = mockedGetBeerBySlug()
    getBeer.mockResolvedValue(hiddenBeer)

    await expect(BeerPage({ params: Promise.resolve({ variant: 'hidden-beer' }) })).rejects.toThrow(
      NotFoundSentinel,
    )
    expect(getBeer).toHaveBeenCalledWith('hidden-beer')
  })

  it('should propagate DB errors without catching them', async () => {
    const getBeer = mockedGetBeerBySlug()
    const dbError = new Error('Database connection failed')
    getBeer.mockRejectedValue(dbError)

    await expect(BeerPage({ params: Promise.resolve({ variant: 'some-beer' }) })).rejects.toThrow(
      dbError,
    )
    expect(getBeer).toHaveBeenCalledWith('some-beer')
  })
})

describe('generateMetadata error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return minimal metadata for hidden beers', async () => {
    mockedGetBeerBySlug().mockResolvedValue(hiddenBeer)

    const metadata = await generateMetadata({
      params: Promise.resolve({ variant: 'hidden-beer' }),
    })

    expect(metadata.title).toBe('Beer Not Found')
    expect(metadata.description).toBeUndefined()
  })

  it('should return minimal metadata for missing beers', async () => {
    mockedGetBeerBySlug().mockResolvedValue(null)

    const metadata = await generateMetadata({
      params: Promise.resolve({ variant: 'nonexistent' }),
    })

    expect(metadata.title).toBe('Beer Not Found')
    expect(metadata.description).toBeUndefined()
  })

  it('should propagate DB errors in generateMetadata', async () => {
    const dbError = new Error('Database connection failed')
    mockedGetBeerBySlug().mockRejectedValue(dbError)

    await expect(
      generateMetadata({ params: Promise.resolve({ variant: 'some-beer' }) }),
    ).rejects.toThrow(dbError)
  })

  it('falls back to a real description when CMS description is an empty string', async () => {
    mockedGetBeerBySlug().mockResolvedValue({
      id: 'beer-2',
      slug: 'lupula',
      name: 'Lupula',
      hideFromSite: false,
      description: '',
      style: { name: 'Hazy India Pale Ale' },
    })

    const metadata = await generateMetadata({
      params: Promise.resolve({ variant: 'lupula' }),
    })

    expect(metadata.description).toMatch(/Lupula/)
    expect(metadata.description).toMatch(/Hazy India Pale Ale/)
    expect(metadata.description?.length).toBeGreaterThan(40)
  })
})


describe('BeerPage server-rendered availability', () => {
  const beer = { id: 'beer-9', slug: 'akko', name: 'Akko', hideFromSite: false }
  const menuWith = (id: string) => ({ items: [{ product: { relationTo: 'beers', value: { id } } }] })

  /** Walk the returned element tree to find BeerDetails' props. */
  async function renderPage() {
    const tree = (await BeerPage({ params: Promise.resolve({ variant: 'akko' }) })) as ReactElement
    const find = (node: unknown): Record<string, unknown> | null => {
      if (!node || typeof node !== 'object') return null
      if (Array.isArray(node)) {
        for (const child of node) {
          const hit = find(child)
          if (hit) return hit
        }
        return null
      }
      const el = node as { type?: unknown; props?: Record<string, unknown> }
      if (el.props && 'beer' in el.props && 'availability' in el.props) return el.props
      return find(el.props?.children)
    }
    return find(tree)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(getDraftMenu as ReturnType<typeof vi.fn>).mockReset().mockResolvedValue(null)
    ;(getCansMenu as ReturnType<typeof vi.fn>).mockReset().mockResolvedValue(null)
    mockedGetBeerBySlug().mockResolvedValue(beer)
    ;(getAllLocations as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'l1', name: 'Lawrenceville', slug: 'lawrenceville' },
      { id: 'l2', name: 'Zelienople', slug: 'zelienople' },
    ])
  })

  it('passes tap and can locations ({name, slug}) and marks the offer in stock', async () => {
    ;(getDraftMenu as ReturnType<typeof vi.fn>).mockImplementation(async (slug: string) =>
      slug === 'lawrenceville' ? menuWith('beer-9') : menuWith('other'),
    )
    ;(getCansMenu as ReturnType<typeof vi.fn>).mockImplementation(async (slug: string) =>
      slug === 'zelienople' ? menuWith('beer-9') : null,
    )

    const props = await renderPage()
    expect(props?.availability).toEqual({
      tap: [{ name: 'Lawrenceville', slug: 'lawrenceville' }],
      cans: [{ name: 'Zelienople', slug: 'zelienople' }],
    })
    expect(generateProductSchema).toHaveBeenCalledWith(beer, { inStock: true })
  })

  it('reports empty availability when no taproom menu lists the beer', async () => {
    const props = await renderPage()
    expect(props?.availability).toEqual({ tap: [], cans: [] })
    expect(generateProductSchema).toHaveBeenCalledWith(beer, { inStock: undefined })
  })

  it('leaves availability and stock unknown when menus fail to load', async () => {
    ;(getDraftMenu as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'))
    const props = await renderPage()
    expect(props?.availability).toBeNull()
    expect(generateProductSchema).toHaveBeenCalledWith(beer, { inStock: undefined })
  })
})
