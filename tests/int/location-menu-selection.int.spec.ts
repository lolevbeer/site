import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Location } from '@/src/payload-types'

const { find, unstableCache } = vi.hoisted(() => ({
  find: vi.fn(),
  unstableCache: vi.fn((fn: () => unknown, _key: string[], _options: unknown) => fn),
}))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ find })) }))
vi.mock('@/src/payload.config', () => ({ default: {} }))
vi.mock('next/cache', () => ({ unstable_cache: unstableCache }))

import { getCansMenu, getDraftMenu } from '@/lib/utils/payload-api'
import { Locations } from '@/src/collections/Locations'
import { up } from '@/src/migrations/20260929_120000_location_website_menus'

beforeEach(() => vi.clearAllMocks())

describe.each([
  ['draft', getDraftMenu],
  ['cans', getCansMenu],
] as const)('selected %s menu', (type, getMenu) => {
  it('queries the exact selection, scoped to the location, type and published status', async () => {
    const selected = { id: 'selected-menu', type, items: [] }
    find
      .mockResolvedValueOnce({
        docs: [{ id: 'loc-1', [`${type}Menu`]: selected.id }],
      })
      .mockResolvedValueOnce({ docs: [selected] })

    expect(await getMenu('lawrenceville')).toEqual(selected)
    expect(find).toHaveBeenLastCalledWith(
      expect.objectContaining({
        collection: 'menus',
        overrideAccess: false,
        where: {
          and: [
            { location: { equals: 'loc-1' } },
            { _status: { equals: 'published' } },
            { or: [{ and: [{ id: { equals: 'selected-menu' } }, { type: { equals: type } }] }] },
          ],
        },
        populate: expect.objectContaining({ beers: expect.objectContaining({ name: true }) }),
        limit: 1,
      }),
    )
    expect(find.mock.calls[0][0]).toMatchObject({ overrideAccess: false })
    expect(unstableCache).toHaveBeenLastCalledWith(
      expect.any(Function),
      ['location-lawrenceville-website-menus'],
      { tags: ['locations', 'menus', 'beers'], revalidate: 300 },
    )
  })

  it.each([undefined, null])(
    'does not guess a menu when the selection is %s',
    async (selection) => {
      find.mockResolvedValue({ docs: [{ id: 'loc-1', [`${type}Menu`]: selection }] })
      expect(await getMenu('lawrenceville')).toBeNull()
      expect(find).toHaveBeenCalledTimes(1)
    },
  )

  it('returns no menu for a missing location or unavailable selection', async () => {
    find.mockResolvedValueOnce({ docs: [] })
    expect(await getMenu('missing')).toBeNull()

    find
      .mockResolvedValueOnce({ docs: [{ id: 'loc-1', [`${type}Menu`]: 'unavailable' }] })
      .mockResolvedValueOnce({ docs: [] })
    expect(await getMenu('lawrenceville')).toBeNull()
  })

  it('propagates database failures instead of caching an empty menu', async () => {
    find.mockRejectedValueOnce(new Error('transient failure'))
    await expect(getMenu('lawrenceville')).rejects.toThrow('transient failure')
  })

  it('restricts the CMS selector to menus of this type at this location', () => {
    const field = Locations.fields
      .flatMap((entry) => (entry.type === 'row' ? entry.fields : []))
      .find((entry) => 'name' in entry && entry.name === `${type}Menu`)
    if (field?.type !== 'relationship' || typeof field.filterOptions !== 'function') {
      throw new Error('Expected a filtered menu relationship')
    }
    expect(field.maxDepth).toBe(0)
    expect(field.filterOptions({ id: 'loc-1' } as never)).toEqual({
      location: { equals: 'loc-1' },
      type: { equals: type },
    })
    expect(field.filterOptions({} as never)).toBe(false)
    expect(field.admin?.description).toMatch(/homepage and \/<location> page/)
  })
})

it('resolves the draft and cans menus with one location lookup and one menu query', async () => {
  const draft = { id: 'draft-menu', type: 'draft', items: [] }
  const cans = { id: 'cans-menu', type: 'cans', items: [] }
  const location = { id: 'loc-1', draftMenu: 'draft-menu', cansMenu: 'cans-menu' }

  // One cache miss for the draft getter: a single location find and a single
  // menus find that fetch both selections.
  find.mockResolvedValueOnce({ docs: [location] }).mockResolvedValueOnce({ docs: [cans, draft] })
  expect(await getDraftMenu('lawrenceville')).toEqual(draft)
  expect(find).toHaveBeenCalledTimes(2)

  // The cans getter reads the same cache entry (same key), so a real cache
  // serves it without any further query; the mocked cache just re-runs it.
  find.mockResolvedValueOnce({ docs: [location] }).mockResolvedValueOnce({ docs: [cans, draft] })
  expect(await getCansMenu('lawrenceville')).toEqual(cans)
  expect(unstableCache.mock.calls.map(([, key]) => key)).toEqual([
    ['location-lawrenceville-website-menus'],
    ['location-lawrenceville-website-menus'],
  ])

  const menuQueries = find.mock.calls.filter(([args]) => args.collection === 'menus')
  expect(menuQueries[0][0]).toMatchObject({
    where: {
      and: [
        { location: { equals: 'loc-1' } },
        { _status: { equals: 'published' } },
        {
          or: [
            { and: [{ id: { equals: 'draft-menu' } }, { type: { equals: 'draft' } }] },
            { and: [{ id: { equals: 'cans-menu' } }, { type: { equals: 'cans' } }] },
          ],
        },
      ],
    },
    limit: 2,
  })
})

it('keeps the cans menu sorted by recipe without changing the cached items', async () => {
  const item = (id: string, recipe: number) => ({
    product: { relationTo: 'beers', value: { id, recipe } },
  })
  const items = [item('older', 10), item('newer', 20)]
  find
    .mockResolvedValueOnce({ docs: [{ id: 'loc-1', cansMenu: { id: 'cans' } }] })
    .mockResolvedValueOnce({ docs: [{ id: 'cans', items }] })
  expect((await getCansMenu('lawrenceville'))?.items).toEqual([items[1], items[0]])
  expect(items.map((entry) => entry.product.value.id)).toEqual(['older', 'newer'])
})

describe('location menu migration', () => {
  it('backfills once through Payload and preserves selections and explicit blanks on retry', async () => {
    const locations: Partial<Location>[] = [
      { id: 'legacy' },
      { id: 'configured', draftMenu: 'chosen', cansMenu: null },
    ]
    const req = { context: {} }
    const migrationFind = vi.fn(async ({ collection, ...args }) => {
      if (collection === 'locations') return { docs: locations }
      return { docs: args.where.type.equals === 'draft' ? [{ id: 'latest-draft' }] : [] }
    })
    const update = vi.fn(async ({ id, data }) => {
      Object.assign(
        locations.find((location) => location.id === id)!,
        data,
      )
    })
    const args = { payload: { find: migrationFind, update }, req } as never
    await up(args)

    expect(update).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        collection: 'locations',
        id: 'legacy',
        data: { draftMenu: 'latest-draft', cansMenu: null },
        overrideAccess: true,
        req,
        context: { skipRevalidate: true },
      }),
    )
    expect(migrationFind).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'menus',
        where: {
          location: { equals: 'legacy' },
          type: { equals: 'draft' },
          _status: { equals: 'published' },
        },
        sort: '-createdAt',
        limit: 1,
        overrideAccess: true,
        req,
      }),
    )

    await up(args)
    expect(update).toHaveBeenCalledTimes(1)
  })
})
