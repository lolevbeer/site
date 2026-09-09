/**
 * TV/kiosk routes must not be indexable even if a crawler ignores robots.txt.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/utils/payload-api', () => ({
  getMenuByUrlFresh: vi.fn(),
  hasAnyBeerJustReleased: vi.fn(),
  getUpcomingEventsFromPayload: vi.fn(),
  getCombinedUpcomingFood: vi.fn(),
  getCansMenu: vi.fn(),
  transformPayloadEventToBreweryEvent: vi.fn((e) => e),
  extractVendorInfo: vi.fn(() => ({ name: 'Vendor' })),
}))

vi.mock('@/src/payload.config', () => ({ default: {} }))
vi.mock('payload', () => ({
  getPayload: vi.fn(),
}))

import type { Metadata } from 'next'
import { generateMetadata as generateMenuMetadata } from '@/src/app/(frontend)/m/[menuUrl]/page'
import { getMenuByUrlFresh } from '@/lib/utils/payload-api'

describe('kiosk generateMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('noindexes menu display URLs', async () => {
    ;(getMenuByUrlFresh as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: 'Lawrenceville Draft',
      type: 'draft',
      description: 'On tap',
    })
    const metadata = await generateMenuMetadata({
      params: Promise.resolve({ menuUrl: 'lawrenceville-draft' }),
    })
    expect(metadata.robots).toEqual({ index: false, follow: false })
    expect((metadata as Metadata).alternates?.canonical).toBeUndefined()
  })
})
