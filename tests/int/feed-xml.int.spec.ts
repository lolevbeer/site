/**
 * Beer items in /feed.xml are dated by createdAt: the nightly Untappd sync
 * bumps updatedAt on every beer, which would re-date the whole feed daily.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/utils/payload-api', () => ({
  getAllBeersFromPayload: vi.fn(async () => [
    {
      name: 'Lupula',
      slug: 'lupula',
      recipe: 1,
      abv: 6,
      createdAt: '2026-09-01T12:00:00.000Z',
      updatedAt: '2026-10-09T03:00:00.000Z',
    },
  ]),
  getAllLocations: vi.fn(async () => []),
  getAllUpcomingEventsFromPayload: vi.fn(async () => []),
  getCombinedUpcomingFood: vi.fn(async () => []),
  extractVendorInfo: vi.fn(() => ({ name: '' })),
}))

vi.mock('@/lib/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

import { GET } from '@/src/app/feed.xml/route'

describe('feed.xml', () => {
  it('dates beer items by createdAt', async () => {
    const xml = await (await GET()).text()
    expect(xml).toContain(
      `<pubDate>${new Date('2026-09-01T12:00:00.000Z').toUTCString()}</pubDate>`,
    )
    expect(xml).not.toContain(new Date('2026-10-09T03:00:00.000Z').toUTCString())
  })
})
