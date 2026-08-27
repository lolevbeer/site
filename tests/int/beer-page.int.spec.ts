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
}))

// Mock media-utils
vi.mock('@/lib/utils/media-utils', () => ({
  getBeerImageUrl: vi.fn((image) => (image ? '/mock-image-url' : null)),
}))

// Mock product-schema and breadcrumb-schema
vi.mock('@/lib/utils/product-schema', () => ({
  generateProductSchema: vi.fn(() => ({})),
}))

vi.mock('@/lib/utils/breadcrumb-schema', () => ({
  generateBreadcrumbSchema: vi.fn(() => ({})),
}))

// Import real page AFTER mocking dependencies
import BeerPage, { generateMetadata } from '@/src/app/(frontend)/beer/[variant]/page'
import { getBeerBySlug } from '@/lib/utils/payload-api'

describe('BeerPage error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should throw NotFoundSentinel when beer slug does not exist', async () => {
    const mockGetBeerBySlug = getBeerBySlug as ReturnType<typeof vi.fn>
    mockGetBeerBySlug.mockResolvedValue(null)

    const params = Promise.resolve({ variant: 'nonexistent' })

    await expect(BeerPage({ params })).rejects.toThrow(NotFoundSentinel)
    expect(mockGetBeerBySlug).toHaveBeenCalledWith('nonexistent')
  })

  it('should throw NotFoundSentinel when beer is hidden from site', async () => {
    const mockGetBeerBySlug = getBeerBySlug as ReturnType<typeof vi.fn>
    const hiddenBeer = {
      id: 'beer-1',
      slug: 'hidden-beer',
      name: 'Hidden Beer',
      hideFromSite: true,
      glass: 'pint' as const,
      abv: 5.5,
      draftPrice: 7,
    }
    mockGetBeerBySlug.mockResolvedValue(hiddenBeer)

    const params = Promise.resolve({ variant: 'hidden-beer' })

    await expect(BeerPage({ params })).rejects.toThrow(NotFoundSentinel)
    expect(mockGetBeerBySlug).toHaveBeenCalledWith('hidden-beer')
  })

  it('should propagate DB errors without catching them', async () => {
    const mockGetBeerBySlug = getBeerBySlug as ReturnType<typeof vi.fn>
    const dbError = new Error('Database connection failed')
    mockGetBeerBySlug.mockRejectedValue(dbError)

    const params = Promise.resolve({ variant: 'some-beer' })

    await expect(BeerPage({ params })).rejects.toThrow(dbError)
    expect(mockGetBeerBySlug).toHaveBeenCalledWith('some-beer')
  })
})

describe('generateMetadata error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return minimal metadata for hidden beers', async () => {
    const mockGetBeerBySlug = getBeerBySlug as ReturnType<typeof vi.fn>
    mockGetBeerBySlug.mockResolvedValue({
      id: 'beer-1',
      slug: 'hidden-beer',
      name: 'Hidden Beer',
      hideFromSite: true,
      glass: 'pint' as const,
      abv: 5.5,
      draftPrice: 7,
    })

    const params = Promise.resolve({ variant: 'hidden-beer' })
    const metadata = await generateMetadata({ params })

    expect(metadata.title).toBe('Beer Not Found')
    // Should not include full OG metadata for hidden beers
    expect(metadata.description).toBeUndefined()
  })

  it('should return minimal metadata for missing beers', async () => {
    const mockGetBeerBySlug = getBeerBySlug as ReturnType<typeof vi.fn>
    mockGetBeerBySlug.mockResolvedValue(null)

    const params = Promise.resolve({ variant: 'nonexistent' })
    const metadata = await generateMetadata({ params })

    expect(metadata.title).toBe('Beer Not Found')
    expect(metadata.description).toBeUndefined()
  })

  it('should propagate DB errors in generateMetadata', async () => {
    const mockGetBeerBySlug = getBeerBySlug as ReturnType<typeof vi.fn>
    const dbError = new Error('Database connection failed')
    mockGetBeerBySlug.mockRejectedValue(dbError)

    const params = Promise.resolve({ variant: 'some-beer' })

    await expect(generateMetadata({ params })).rejects.toThrow(dbError)
  })
})
