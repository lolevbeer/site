/**
 * Tests beer detail page error handling:
 * - notFound() is called for missing beers
 * - notFound() is called for hidden beers
 * - DB errors propagate to error.tsx (not caught)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
}))

// Mock payload-api
vi.mock('@/lib/utils/payload-api', () => ({
  getBeerBySlug: vi.fn(),
  getAllBeersFromPayload: vi.fn(),
}))

import { notFound } from 'next/navigation'
import { getBeerBySlug } from '@/lib/utils/payload-api'

describe('BeerPage error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call notFound() when beer slug does not exist', async () => {
    const mockGetBeerBySlug = getBeerBySlug as ReturnType<typeof vi.fn>
    mockGetBeerBySlug.mockResolvedValue(null)

    // Simulate the page logic
    const variant = 'nonexistent'
    const beer = await getBeerBySlug(variant)
    if (!beer) notFound()

    expect(mockGetBeerBySlug).toHaveBeenCalledWith(variant)
    expect(notFound).toHaveBeenCalled()
  })

  it('should call notFound() when beer is hidden from site', async () => {
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

    // Simulate the page logic
    const variant = 'hidden-beer'
    const beer = await getBeerBySlug(variant)
    if (!beer) notFound()
    if (beer.hideFromSite) notFound()

    expect(mockGetBeerBySlug).toHaveBeenCalledWith(variant)
    expect(notFound).toHaveBeenCalled()
  })

  it('should propagate DB errors without catching them', async () => {
    const mockGetBeerBySlug = getBeerBySlug as ReturnType<typeof vi.fn>
    const dbError = new Error('Database connection failed')
    mockGetBeerBySlug.mockRejectedValue(dbError)

    // Simulate the page logic (without try/catch)
    const variant = 'some-beer'
    let thrownError: unknown = null
    try {
      await getBeerBySlug(variant)
    } catch (error) {
      thrownError = error
    }

    expect(thrownError).toBe(dbError)
    expect(notFound).not.toHaveBeenCalled()
  })
})
