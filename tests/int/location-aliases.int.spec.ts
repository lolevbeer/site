/**
 * Location aliases: a renamed taproom keeps its old slug as an alias so TV
 * kiosks on /e/<old-slug>, links to /<old-slug>, and ?loc=<old-slug> keep working.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CollectionBeforeChangeHook, PayloadRequest, TextField } from 'payload'
import type { PayloadLocation } from '@/lib/types/location'

const { find, permanentRedirect, notFound, getAllLocations, liveEvents } = vi.hoisted(() => ({
  find: vi.fn(),
  permanentRedirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
  getAllLocations: vi.fn(),
  liveEvents: vi.fn((_props: unknown) => null),
}))

vi.mock('payload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('payload')>()),
  getPayload: vi.fn(async () => ({ find })),
}))
vi.mock('@/src/payload.config', () => ({ default: {} }))
vi.mock('next/navigation', () => ({ permanentRedirect, notFound }))
vi.mock('@/components/events/live-events', () => ({
  LiveEvents: (props: unknown) => liveEvents(props),
}))
vi.mock('@/lib/utils/payload-api', () => ({
  getAllLocations,
  extractVendorInfo: vi.fn(() => ({ name: 'Vendor' })),
  getCansMenu: vi.fn(async () => null),
  getDraftMenu: vi.fn(async () => null),
  getCombinedUpcomingFood: vi.fn(async () => []),
  getUpcomingEventsFromPayload: vi.fn(async () => []),
  getWeeklyHoursWithHolidays: vi.fn(async () => []),
  transformPayloadEventToBreweryEvent: vi.fn(),
}))

import { Locations } from '@/src/collections/Locations'
import { findLocationBySlug, isValidLocationSlug } from '@/lib/config/locations'
import EventsDisplayPage from '@/src/app/(frontend)/e/[location]/page'
import LocationPage from '@/src/app/(frontend)/[location]/page'

const lawrenceville = {
  id: 'loc-1',
  name: 'Lawrenceville',
  slug: 'lolev-lawrenceville',
  aliases: ['old-lawrenceville'],
  active: true,
} as PayloadLocation

beforeEach(() => {
  vi.clearAllMocks()
  find.mockResolvedValue({ docs: [] })
  getAllLocations.mockResolvedValue([lawrenceville])
})

const beforeChange = Locations.hooks!.beforeChange![0] as CollectionBeforeChangeHook
const aliasesField = Locations.fields.find(
  (field) => 'name' in field && field.name === 'aliases',
) as TextField

function runHook(data: Record<string, unknown>, originalDoc: Record<string, unknown>) {
  return beforeChange({
    data: { ...data },
    originalDoc,
    operation: 'update',
    req: { payload: { find } } as unknown as PayloadRequest,
    collection: Locations as never,
    context: {},
  })
}

describe('rename records the old slug', () => {
  it('pushes the previous slug into aliases when the name changes', async () => {
    find.mockResolvedValue({ docs: [] }) // slug uniqueness check
    const data = await runHook(
      { name: 'Lolev Strip' },
      { id: 'loc-1', name: 'Lawrenceville', slug: 'lolev-lawrenceville', aliases: ['older'] },
    )
    expect(data.slug).toBe('lolev-strip')
    expect(data.aliases).toEqual(['older', 'lolev-lawrenceville'])
  })

  it('drops the current slug from aliases when renamed back', async () => {
    const data = await runHook(
      { name: 'Lolev Lawrenceville' },
      { id: 'loc-1', name: 'Lolev Strip', slug: 'lolev-strip', aliases: ['lolev-lawrenceville'] },
    )
    expect(data.slug).toBe('lolev-lawrenceville')
    expect(data.aliases).toEqual(['lolev-strip'])
  })

  it('does not record a reserved old slug (it would never resolve)', async () => {
    const data = await runHook(
      { name: 'Lolev Lawrenceville' },
      { id: 'loc-1', name: 'Lawrenceville', slug: 'lawrenceville', aliases: [] },
    )
    expect(data.aliases).toEqual([])
  })
})

describe('alias validation', () => {
  const validate = (value: string[], id = 'loc-1') =>
    aliasesField.validate!(value as never, {
      id,
      req: { payload: { find } },
      siblingData: { slug: 'lolev-lawrenceville' },
    } as never)

  it('accepts a free alias', async () => {
    expect(await validate(['old-lawrenceville'])).toBe(true)
  })

  it('rejects a reserved route slug', async () => {
    expect(await validate(['events'])).toMatch(/reserved/i)
  })

  it('rejects an alias that is not a lowercase slug', async () => {
    expect(await validate(['Old Lawrenceville'])).toMatch(/lowercase/i)
  })

  it("rejects another location's slug or alias, reading as the editor", async () => {
    find.mockResolvedValue({ docs: [{ name: 'Zelienople' }] })
    expect(await validate(['lolev-zelienople'])).toMatch(/Zelienople/)
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'locations',
        overrideAccess: false,
        where: {
          and: [
            { id: { not_equals: 'loc-1' } },
            {
              or: [
                { slug: { in: ['lolev-zelienople'] } },
                { aliases: { in: ['lolev-zelienople'] } },
              ],
            },
          ],
        },
      }),
    )
  })
})

describe('shared resolver', () => {
  it('resolves a slug or an alias to the location', () => {
    expect(findLocationBySlug([lawrenceville], 'lolev-lawrenceville')).toBe(lawrenceville)
    expect(findLocationBySlug([lawrenceville], 'old-lawrenceville')).toBe(lawrenceville)
    expect(isValidLocationSlug([lawrenceville], 'old-lawrenceville')).toBe(true)
    expect(findLocationBySlug([lawrenceville], 'nope')).toBeUndefined()
  })

  it("prefers a location's slug over another location's alias", () => {
    const other = { ...lawrenceville, id: 'loc-2', slug: 'old-lawrenceville', aliases: [] }
    expect(findLocationBySlug([lawrenceville, other], 'old-lawrenceville')).toBe(other)
  })
})

describe('routes', () => {
  it('/e/<alias> renders the board for the current slug (no redirect)', async () => {
    find.mockResolvedValue({ docs: [lawrenceville] })
    const element = await EventsDisplayPage({
      params: Promise.resolve({ location: 'old-lawrenceville' }),
    })
    expect(permanentRedirect).not.toHaveBeenCalled()
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'locations',
        overrideAccess: false,
        where: {
          or: [
            { slug: { equals: 'old-lawrenceville' } },
            { aliases: { in: ['old-lawrenceville'] } },
          ],
        },
      }),
    )
    expect((element as { props: { location: string } }).props.location).toBe(
      'lolev-lawrenceville',
    )
  })

  it('/<alias> permanently redirects to the current slug', async () => {
    await expect(
      LocationPage({ params: Promise.resolve({ location: 'old-lawrenceville' }) }),
    ).rejects.toThrow('REDIRECT /lolev-lawrenceville')
    expect(permanentRedirect).toHaveBeenCalledWith('/lolev-lawrenceville')
  })
})
