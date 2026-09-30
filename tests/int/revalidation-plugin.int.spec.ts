/**
 * Collection cache maps used by hooks and by bulk writers that skip
 * per-document revalidation then call revalidateForCollection once.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const publishKioskInvalidate = vi.hoisted(() => vi.fn())
vi.mock('@/lib/ably/publish', () => ({ publishKioskInvalidate }))

const revalidateTag = vi.fn()
const revalidatePath = vi.fn()
vi.mock('next/cache', () => ({
  revalidateTag: (...args: unknown[]) => revalidateTag(...args),
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}))

import { revalidateForCollection, revalidationPlugin } from '@/src/plugins/revalidation-plugin'
import type { Config } from 'payload'

type Hook = (args: { doc: object; req?: object; context?: object }) => Promise<unknown>

async function hooksFor(slug: string) {
  const config = await revalidationPlugin({
    collections: [{ slug, fields: [] }],
  } as unknown as Config)
  const hooks = config.collections![0].hooks!
  return { afterChange: hooks.afterChange![0] as Hook, afterDelete: hooks.afterDelete![0] as Hook }
}

const hardExpired = () =>
  revalidateTag.mock.calls
    .filter(([, profile]) => typeof profile === 'object')
    .map(([tag]) => tag)
    .sort()

describe('kiosk cache invalidation', () => {
  // Only the tags the kiosk stream responses carry are hard-expired (a push
  // triggers one fetch that must be fresh). Every other tag, including the broad
  // 'menus'/'locations' that public pages share, stays stale-while-revalidate.
  it.each([
    ['menus', ['kiosk-menus'], ['menus']],
    ['locations', ['kiosk-menus'], ['locations', 'menus']],
    ['products', ['kiosk-menus'], ['products', 'menus']],
    ['events', ['events'], []],
    ['recurring-events', ['events'], []],
  ])('%s expires only kiosk tags before the next display fetch', async (slug, hard, soft) => {
    const { afterChange, afterDelete } = await hooksFor(slug)
    for (const hook of [afterChange, afterDelete]) {
      revalidateTag.mockClear()
      await hook({ doc: {} })
      expect(hardExpired()).toEqual(hard)
      for (const tag of soft) expect(revalidateTag).toHaveBeenCalledWith(tag, 'max')
    }
  })
})

describe('draft-only saves', () => {
  beforeEach(() => {
    revalidateTag.mockReset()
    revalidatePath.mockReset()
    publishKioskInvalidate.mockReset()
  })

  it('skip cache invalidation and kiosk pushes: nothing published changed', async () => {
    const { afterChange } = await hooksFor('menus')
    await afterChange({
      doc: { _status: 'draft', url: 'z-cans' },
      req: { query: { draft: 'true' } },
    })
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(publishKioskInvalidate).not.toHaveBeenCalled()
  })

  it('still run for publish, unpublish, and deletes', async () => {
    const { afterChange, afterDelete } = await hooksFor('menus')
    await afterChange({ doc: { _status: 'published', url: 'z-cans' }, req: { query: {} } })
    expect(publishKioskInvalidate).toHaveBeenCalledTimes(1)
    // Unpublish sends _status draft without draft=true.
    await afterChange({ doc: { _status: 'draft', url: 'z-cans' }, req: { query: {} } })
    expect(publishKioskInvalidate).toHaveBeenCalledTimes(2)
    await afterDelete({
      doc: { _status: 'draft', url: 'z-cans' },
      req: { query: { draft: 'true' } },
    })
    expect(publishKioskInvalidate).toHaveBeenCalledTimes(3)
  })
})

describe('kiosk push keys', () => {
  const findByID = vi.fn()
  const req = { payload: { findByID }, query: {} }

  beforeEach(() => {
    revalidateTag.mockReset()
    publishKioskInvalidate.mockReset()
    findByID.mockReset()
  })

  it('scopes a menu save to that menu url', async () => {
    const { afterChange } = await hooksFor('menus')
    await afterChange({ doc: { url: 'z-cans' }, req })
    expect(publishKioskInvalidate).toHaveBeenCalledWith({ kind: 'menu', keys: ['z-cans'] })
  })

  it('scopes an event save to its location slug when the relationship is populated', async () => {
    const { afterChange } = await hooksFor('events')
    await afterChange({ doc: { location: { id: 'loc-1', slug: 'lawrenceville' } }, req })
    expect(publishKioskInvalidate).toHaveBeenCalledWith({ kind: 'events', keys: ['lawrenceville'] })
    expect(findByID).not.toHaveBeenCalled()
  })

  it.each(['events', 'recurring-events'])(
    'resolves a bare location id to its slug for %s saves, inside the save transaction',
    async (slug) => {
      findByID.mockResolvedValue({ slug: 'zelienople' })
      const { afterChange } = await hooksFor(slug)
      await afterChange({ doc: { location: 'loc-2' }, req })
      expect(findByID).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'locations',
          id: 'loc-2',
          depth: 0,
          overrideAccess: true,
          req,
        }),
      )
      expect(publishKioskInvalidate).toHaveBeenCalledWith({ kind: 'events', keys: ['zelienople'] })
    },
  )

  it('falls back to refreshing every display when the location cannot be resolved', async () => {
    findByID.mockRejectedValue(new Error('not found'))
    const { afterChange } = await hooksFor('events')
    await expect(afterChange({ doc: { location: 'gone' }, req })).resolves.toBeDefined()
    expect(publishKioskInvalidate).toHaveBeenCalledWith({ kind: 'events' })
  })

  it('refreshes every display for an event saved with no location', async () => {
    const { afterChange } = await hooksFor('events')
    await afterChange({ doc: {}, req })
    expect(publishKioskInvalidate).toHaveBeenCalledWith({ kind: 'events' })
    expect(findByID).not.toHaveBeenCalled()
  })

  // The events kiosk gets food only as a server-rendered prop, never through the
  // events stream, so a food save cannot change what a display would refetch.
  it.each(['food', 'recurring-food-schedules', 'recurring-food-exclusions', 'food-vendors'])(
    '%s saves push nothing to the kiosks and do no location lookup',
    async (slug) => {
      const { afterChange, afterDelete } = await hooksFor(slug)
      await afterChange({ doc: { location: 'loc-2' }, req })
      await afterDelete({ doc: { location: 'loc-2' }, req })
      expect(publishKioskInvalidate).not.toHaveBeenCalled()
      expect(findByID).not.toHaveBeenCalled()
      // Cache invalidation for the public food pages is unaffected.
      expect(revalidateTag).toHaveBeenCalledWith('food', 'max')
    },
  )

  // Menus embed the location (hours, lines cleaned) and 'kiosk-menus' is
  // hard-expired, so the push fetches fresh data. The events stream only carries
  // the location name, and its 'locations' cache is just marked stale, so an
  // events push would refetch stale data: it is deliberately not sent.
  it('pushes a location edit to every menu display and nothing to the events displays', async () => {
    const { afterChange } = await hooksFor('locations')
    await afterChange({ doc: { slug: 'lawrenceville' }, req })
    expect(publishKioskInvalidate).toHaveBeenCalledTimes(1)
    expect(publishKioskInvalidate).toHaveBeenCalledWith({ kind: 'menu' })
  })

  it('batch invalidation (no doc) pushes without keys', async () => {
    revalidateForCollection('events')
    await vi.waitFor(() => expect(publishKioskInvalidate).toHaveBeenCalledWith({ kind: 'events' }))
  })
})

describe('revalidateForCollection', () => {
  beforeEach(() => {
    revalidateTag.mockReset()
    revalidatePath.mockReset()
  })

  it('invalidates homepage and location event pages for recurring-food writes', () => {
    revalidateForCollection('recurring-food-schedules')

    expect(revalidateTag.mock.calls.map((call) => call[0]).sort()).toEqual([
      'food',
      'recurring-food',
    ])
    expect(revalidatePath.mock.calls).toEqual(
      expect.arrayContaining([['/'], ['/food'], ['/e', 'layout']]),
    )
  })

  it('keeps beer bulk invalidation on the beers list paths', () => {
    revalidateForCollection('beers')

    expect(revalidateTag.mock.calls.map((call) => call[0]).sort()).toEqual([
      'beers',
      'kiosk-menus',
      'menus',
    ])
    expect(revalidatePath.mock.calls.map((call) => call[0]).sort()).toEqual([
      '/',
      '/beer',
      '/beer/[variant]',
    ])
    expect(revalidatePath).toHaveBeenCalledWith('/beer/[variant]', 'page')
    // Kiosk menu streams must be fresh on the push; public pages sharing 'menus' need not be.
    expect(revalidateTag).toHaveBeenCalledWith('kiosk-menus', { expire: 0 })
    expect(revalidateTag).toHaveBeenCalledWith('menus', 'max')
  })
})

describe('site-seo global hook', () => {
  it('revalidates the whole route tree, since every page reads it for metadata', async () => {
    revalidateTag.mockReset()
    revalidatePath.mockReset()
    const config = await revalidationPlugin({
      globals: [{ slug: 'site-seo', fields: [] }],
    } as unknown as Config)
    const hook = config.globals![0].hooks!.afterChange![0] as (args: {
      doc: object
    }) => Promise<unknown>

    await hook({ doc: {} })

    expect(revalidateTag).toHaveBeenCalledWith('site-seo', 'max')
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })
})
