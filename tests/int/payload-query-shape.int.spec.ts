/**
 * Catalog/menu Payload queries must not serialize unbounded reviews or 3D
 * label uploads. Next.js `unstable_cache` throws in dev (and skips in prod)
 * when an entry exceeds 2MB — the full beers find crossed that on /beer.
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

import {
  getAllBeersFromPayload,
  getAvailableBeersFromMenus,
  getMenusByLocation,
} from '@/lib/utils/payload-api'

beforeEach(() => {
  find.mockReset()
})

function beersQuery() {
  return find.mock.calls.map((call) => call[0] as Record<string, unknown>).find(
    (args) => args.collection === 'beers',
  )
}

function menusQuery() {
  return find.mock.calls.map((call) => call[0] as Record<string, unknown>).find(
    (args) => args.collection === 'menus',
  )
}

describe('Payload query shape for cacheable beer lists', () => {
  it('getAllBeersFromPayload drops the reviews join and 3D label uploads', async () => {
    find.mockResolvedValue({ docs: [] })
    await getAllBeersFromPayload()

    const query = beersQuery()
    expect(query).toBeTruthy()
    expect(query?.joins).toBe(false)

    const select = query?.select as Record<string, boolean> | undefined
    expect(select?.name).toBe(true)
    expect(select?.slug).toBe(true)
    expect(select?.image).toBe(true)
    expect(select?.positiveReviews).toBeUndefined()
    expect(select?.reviews).toBeUndefined()
    expect(select?.labelBase).toBeUndefined()
    expect(select?.labelMetalness).toBeUndefined()
    expect(select?.labelVideo).toBeUndefined()
    const populate = query?.populate as { styles?: { name?: boolean }; media?: { url?: boolean } }
    expect(populate?.styles?.name).toBe(true)
    expect(populate?.media?.url).toBe(true)
  })

  it('getMenusByLocation populates beers without positiveReviews', async () => {
    find.mockImplementation(async (args: { collection: string }) => {
      if (args.collection === 'locations') {
        return { docs: [{ id: 'loc-1', slug: 'lawrenceville' }] }
      }
      return { docs: [] }
    })
    await getMenusByLocation('lawrenceville')

    const query = menusQuery()
    const populate = query?.populate as { beers?: Record<string, boolean> } | undefined
    expect(populate?.beers?.name).toBe(true)
    expect(populate?.beers?.canSingle).toBe(true)
    expect(populate?.beers?.positiveReviews).toBeUndefined()
    expect(populate?.beers?.labelBase).toBeUndefined()
  })

  it('getAvailableBeersFromMenus uses the same narrowed menu populate', async () => {
    find.mockResolvedValue({ docs: [] })
    await getAvailableBeersFromMenus()

    const query = menusQuery()
    const populate = query?.populate as { beers?: Record<string, boolean> } | undefined
    expect(populate?.beers?.name).toBe(true)
    expect(populate?.beers?.positiveReviews).toBeUndefined()
  })
})
