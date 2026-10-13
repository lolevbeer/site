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
import { findLocationBySlug } from '@/lib/config/locations'
import EventsDisplayPage from '@/src/app/(frontend)/e/[location]/page'
import LocationPage, { generateMetadata } from '@/src/app/(frontend)/[location]/page'
import { getDraftMenu } from '@/lib/utils/payload-api'
import { generateUniqueSlug } from '@/src/collections/utils/generateUniqueSlug'
import { GET as eventsStreamGET } from '@/src/app/api/events-stream/[location]/route'

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
  const validate = (value: string[], id = 'loc-1', previousValue: string[] = []) =>
    aliasesField.validate!(
      value as never,
      {
        id,
        previousValue,
        req: { payload: { find } },
        siblingData: { slug: 'lolev-lawrenceville' },
      } as never,
    )

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
    find.mockResolvedValue({
      docs: [{ name: 'Zelienople', slug: 'lolev-zelienople', aliases: [] }],
    })
    expect(await validate(['lolev-zelienople'])).toBe(
      '"lolev-zelienople" is already the slug or an alias of Zelienople.',
    )
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

describe('slug validation', () => {
  const slugField = Locations.fields.find(
    (field) => 'name' in field && field.name === 'slug',
  ) as TextField
  const validate = (value: string) => slugField.validate!(value as never, {} as never)

  it('accepts a lowercase slug', async () => {
    expect(await validate('lolev-lawrenceville')).toBe(true)
  })

  it.each(['/evil.com', '//evil.com', 'Lolev Lawrenceville', 'a/b', 'evil.com'])(
    'rejects %s (it is used as a redirect target)',
    async (slug) => {
      expect(await validate(slug)).toMatch(/lowercase/i)
    },
  )
})

describe('alias validation only checks new aliases', () => {
  const validate = (value: string[], previousValue: string[]) =>
    aliasesField.validate!(
      value as never,
      { id: 'loc-1', previousValue, req: { payload: { find } } } as never,
    )

  it('an unchanged alias never blocks an unrelated save (no query)', async () => {
    find.mockResolvedValue({ docs: [{ name: 'Zelienople', slug: 'old-lawrenceville' }] })
    expect(await validate(['old-lawrenceville'], ['old-lawrenceville'])).toBe(true)
    expect(find).not.toHaveBeenCalled()
  })

  it('checks only the added alias', async () => {
    await validate(['old-lawrenceville', 'new-alias'], ['old-lawrenceville'])
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          and: [
            { id: { not_equals: 'loc-1' } },
            { or: [{ slug: { in: ['new-alias'] } }, { aliases: { in: ['new-alias'] } }] },
          ],
        },
      }),
    )
  })
})

describe("a new slug never takes another location's alias", () => {
  it('suffixes a slug that another location keeps as an alias', async () => {
    find.mockImplementation(
      async ({ where }: { where: { or: Array<Record<string, unknown>> } }) => {
        const taken = where.or.some(
          (clause) =>
            JSON.stringify(clause) === JSON.stringify({ aliases: { in: ['old-lawrenceville'] } }),
        )
        return { docs: taken ? [{ slug: 'lolev-lawrenceville' }] : [] }
      },
    )
    const slug = await generateUniqueSlug(
      'Old Lawrenceville',
      'locations',
      { payload: { find } } as unknown as PayloadRequest,
      'loc-2',
      ['slug', 'aliases'],
    )
    expect(slug).toBe('old-lawrenceville-1')
  })

  it('the Locations rename checks aliases too', async () => {
    await runHook({ name: 'Old Lawrenceville' }, { id: 'loc-2', name: 'Zelienople', slug: 'z' })
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          or: [{ slug: { in: ['old-lawrenceville'] } }, { aliases: { in: ['old-lawrenceville'] } }],
          id: { not_equals: 'loc-2' },
        },
      }),
    )
  })
})

describe('shared resolver', () => {
  it('resolves a slug or an alias to the location', () => {
    expect(findLocationBySlug([lawrenceville], 'lolev-lawrenceville')).toBe(lawrenceville)
    expect(findLocationBySlug([lawrenceville], 'old-lawrenceville')).toBe(lawrenceville)
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
    expect((element as { props: { location: string } }).props.location).toBe('lolev-lawrenceville')
  })

  it('/<alias> permanently redirects to the current slug', async () => {
    await expect(
      LocationPage({ params: Promise.resolve({ location: 'old-lawrenceville' }) }),
    ).rejects.toThrow('REDIRECT /lolev-lawrenceville')
    expect(permanentRedirect).toHaveBeenCalledWith('/lolev-lawrenceville')
    // Redirects before loading the page's menus, events, and food.
    expect(getDraftMenu).not.toHaveBeenCalled()
  })

  it('never redirects to a malformed stored slug (no //host open redirect)', async () => {
    getAllLocations.mockResolvedValue([{ ...lawrenceville, slug: '/evil.com' }])
    await expect(
      LocationPage({ params: Promise.resolve({ location: 'old-lawrenceville' }) }),
    ).rejects.toThrow('NOT_FOUND')
    expect(permanentRedirect).not.toHaveBeenCalled()
  })

  it('/<alias> metadata redirects too', async () => {
    await expect(
      generateMetadata({ params: Promise.resolve({ location: 'old-lawrenceville' }) }),
    ).rejects.toThrow('REDIRECT /lolev-lawrenceville')
  })

  it('the events polling endpoint accepts an alias', async () => {
    const response = await eventsStreamGET({} as never, {
      params: Promise.resolve({ location: 'old-lawrenceville' }),
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ locationName: 'Lawrenceville' })
  })
})
