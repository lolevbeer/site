/**
 * Beer save hooks run system lookups (slug/recipe uniqueness, menu cache
 * invalidation). They must see every document whoever triggered the save, so
 * each inner Local API call passes an explicit `overrideAccess: true` and the
 * hook's own `req` so it joins the save transaction.
 */
import { describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@/lib/ably/publish', () => ({ publishKioskInvalidate: vi.fn() }))

import { revalidateTag } from 'next/cache'
import { publishKioskInvalidate } from '@/lib/ably/publish'
import { Beers } from '@/src/collections/Beers'
import { generateUniqueSlug } from '@/src/collections/utils/generateUniqueSlug'

type AnyHook = (args: Record<string, unknown>) => unknown

function mockReq() {
  const find = vi.fn(async (_args: Record<string, unknown>) => ({ docs: [] as unknown[] }))
  const req = {
    user: { id: 'manager', roles: ['beer-manager'] },
    context: {},
    payload: { find },
  } as unknown as PayloadRequest
  return { req, find }
}

describe('beer hook system lookups', () => {
  it('generateUniqueSlug checks published and draft slugs with req and overrideAccess: true', async () => {
    const { req, find } = mockReq()

    await expect(generateUniqueSlug('Akko', 'beers', req, 'create')).resolves.toBe('akko')

    expect(find).toHaveBeenCalledTimes(2)
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'beers', draft: false, overrideAccess: true, req }),
    )
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'beers', draft: true, overrideAccess: true, req }),
    )
  })

  it('Beers beforeChange recipe max and uniqueness checks pass req and overrideAccess: true', async () => {
    const { req, find } = mockReq()
    const hook = Beers.hooks!.beforeChange![0] as unknown as AnyHook

    await hook({ req, operation: 'create', data: { name: 'Akko', slug: 'akko' } })

    const recipeCalls = find.mock.calls.filter(([args]) => args.collection === 'beers')
    expect(recipeCalls).toHaveLength(2)
    for (const [args] of recipeCalls) {
      expect(args).toEqual(expect.objectContaining({ overrideAccess: true, req }))
    }
  })

  it('Beers afterChange menu revalidation lookup passes req and overrideAccess: true', async () => {
    const { req, find } = mockReq()
    find.mockResolvedValueOnce({ docs: [{ url: 'z-cans' }] })
    const hook = Beers.hooks!.afterChange![0] as unknown as AnyHook

    await hook({ req, context: {}, doc: { id: 'beer-1' }, previousDoc: { id: 'beer-1' } })

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'menus', overrideAccess: true, req }),
    )
    expect(revalidateTag).toHaveBeenCalledWith('menu-z-cans', { expire: 0 })
    expect(publishKioskInvalidate).toHaveBeenCalledWith({ kind: 'menu', key: 'z-cans' })
  })
})
