/**
 * Public pages read Payload as an anonymous visitor. Each public read must pass
 * `overrideAccess: false` explicitly (the omitted default is false on Payload 4
 * but was true on Payload 3) so collection access rules always apply.
 * Covers lib/jobs, /food, and /e/[location]. (Recurring food state reads are
 * covered in recurring-food-state.int.spec.ts.)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
  revalidateTag: vi.fn(),
}))

vi.mock('@/lib/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const find = vi.fn()
vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({ find })),
}))
vi.mock('@/src/payload.config', () => ({ default: {} }))

vi.mock('@/lib/utils/payload-api', () => ({
  getAllLocations: vi.fn(async () => []),
  extractVendorInfo: vi.fn(() => ({ name: 'Vendor' })),
  getCansMenu: vi.fn(async () => null),
  getCombinedUpcomingFood: vi.fn(async () => []),
  getUpcomingEventsFromPayload: vi.fn(async () => []),
  transformPayloadEventToBreweryEvent: vi.fn(),
}))

vi.mock('@/src/utils/recurring-food', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/src/utils/recurring-food')>()),
  getRecurringFoodState: vi.fn(async (_payload: unknown, { year }: { year: number }) => ({
    year,
    schedules: { 'loc-1': { monday: { first: 'vendor-1' } } },
    exclusions: {},
  })),
}))

vi.mock('@/src/app/(frontend)/food/food-page-client', () => ({ FoodPageClient: () => null }))
vi.mock('@/components/motion', () => ({ PageTransition: () => null }))
vi.mock('@/components/seo/json-ld', () => ({ JsonLd: () => null }))
vi.mock('@/components/events/live-events', () => ({ LiveEvents: () => null }))

import { getActiveJobs, getJobBySlug } from '@/lib/jobs/payload'
import FoodPage from '@/src/app/(frontend)/food/page'
import { generateMetadata as eventsDisplayMetadata } from '@/src/app/(frontend)/e/[location]/page'

beforeEach(() => {
  find.mockReset()
  find.mockResolvedValue({ docs: [] })
})

/** The args of the find call for a collection; fails if there was none. */
function findArgs(collection: string): Record<string, unknown> {
  const args = find.mock.calls
    .map((call) => call[0] as Record<string, unknown>)
    .find((a) => a.collection === collection)
  expect(args, `no find on ${collection}`).toBeDefined()
  return args!
}

describe('public reads pass overrideAccess: false', () => {
  it('getActiveJobs', async () => {
    await getActiveJobs()
    expect(findArgs('jobs').overrideAccess).toBe(false)
  })

  it('getJobBySlug', async () => {
    await getJobBySlug('bartender')
    expect(findArgs('jobs').overrideAccess).toBe(false)
  })

  it('/food food, locations, and food-vendors reads', async () => {
    await FoodPage()
    expect(findArgs('food').overrideAccess).toBe(false)
    expect(findArgs('locations').overrideAccess).toBe(false)
    expect(findArgs('food-vendors').overrideAccess).toBe(false)
  })

  it('/e/[location] location lookup', async () => {
    await eventsDisplayMetadata({ params: Promise.resolve({ location: 'lawrenceville' }) })
    expect(findArgs('locations').overrideAccess).toBe(false)
  })
})
