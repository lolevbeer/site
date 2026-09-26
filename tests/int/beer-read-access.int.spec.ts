/**
 * Read access for the Beers collection: which roles see every beer, which
 * unpublished beers the public may read (on a published menu or Coming Soon),
 * and the draft guard that keeps unpublished edits of those beers private.
 */
import { describe, expect, it, vi } from 'vitest'
import type { User } from '@/src/payload-types'
import { Beers, canReadBeers } from '@/src/collections/Beers'

function userWith(roles: User['roles']): User {
  return {
    id: 'user-id',
    collection: 'users',
    email: 'user@example.com',
    roles,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

interface MockReqOptions {
  user?: User | null
  menuItems?: { product?: { relationTo: string; value: string } | null }[][]
  comingSoon?: string[]
  query?: Record<string, unknown>
  data?: Record<string, unknown>
  payloadAPI?: 'GraphQL' | 'local' | 'REST'
}

function mockReq({
  user = null,
  menuItems = [],
  comingSoon = [],
  query = {},
  data,
  payloadAPI = 'local',
}: MockReqOptions = {}) {
  const find = vi.fn(async () => ({ docs: menuItems.map((items) => ({ items })) }))
  const findGlobal = vi.fn(async () => ({ beers: comingSoon.map((beer) => ({ beer })) }))
  const req = { user, context: {}, query, data, payloadAPI, payload: { find, findGlobal } }
  return { req, find, findGlobal }
}

function callRead(access: unknown, req: unknown) {
  if (typeof access !== 'function') throw new Error('Expected access function')
  return access({ req })
}

const publishedOnly = { _status: { equals: 'published' } }

describe('canReadBeers', () => {
  it.each(['admin', 'beer-manager', 'bartender', 'lead-bartender'] as const)(
    'lets %s read every beer',
    async (role) => {
      const { req, find } = mockReq({ user: userWith([role]) })
      expect(await callRead(canReadBeers, req)).toBe(true)
      expect(find).not.toHaveBeenCalled()
    },
  )

  it('lets the public read published beers plus beers on published menus and Coming Soon', async () => {
    const { req, find, findGlobal } = mockReq({
      menuItems: [
        [
          { product: { relationTo: 'beers', value: 'beer-1' } },
          { product: { relationTo: 'products', value: 'product-1' } },
        ],
        [{ product: { relationTo: 'beers', value: 'beer-2' } }, { product: null }],
      ],
      comingSoon: ['beer-3', 'beer-1'],
    })

    const result = await callRead(canReadBeers, req)

    expect(result).toEqual({ or: [publishedOnly, { id: { in: expect.any(Array) } }] })
    const ids = (result as { or: [unknown, { id: { in: string[] } }] }).or[1].id.in
    expect([...ids].sort()).toEqual(['beer-1', 'beer-2', 'beer-3'])

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'menus',
        where: { _status: { equals: 'published' } },
        overrideAccess: true,
        depth: 0,
        pagination: false,
        select: { items: { product: true } },
        req,
      }),
    )
    expect(findGlobal).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'coming-soon',
        overrideAccess: true,
        depth: 0,
        select: { beers: { beer: true } },
        req,
      }),
    )
  })

  it('falls back to published-only when no menu or Coming Soon beers exist', async () => {
    const { req } = mockReq({ user: userWith(['event-manager']) })
    expect(await callRead(canReadBeers, req)).toEqual(publishedOnly)
  })

  it('looks up public beer IDs once per request', async () => {
    const { req, find, findGlobal } = mockReq({ comingSoon: ['beer-1'] })
    await callRead(canReadBeers, req)
    await callRead(canReadBeers, req)
    expect(find).toHaveBeenCalledTimes(1)
    expect(findGlobal).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['REST find (query parsed to boolean)', { query: { draft: true }, payloadAPI: 'REST' }],
    ['REST findByID (raw query string)', { query: { draft: 'true' }, payloadAPI: 'REST' }],
    ['REST method-override body', { data: { draft: true }, payloadAPI: 'REST' }],
  ] as const)('denies anonymous draft reads: %s', async (_label, options) => {
    const { req, find } = mockReq({ ...options, comingSoon: ['beer-1'] })
    expect(await callRead(canReadBeers, req)).toBe(false)
    expect(find).not.toHaveBeenCalled()
  })

  it('still lets full-read roles read drafts', async () => {
    const { req } = mockReq({ user: userWith(['bartender']), query: { draft: 'true' } })
    expect(await callRead(canReadBeers, req)).toBe(true)
  })

  it('keeps GraphQL to published beers, since GraphQL does not expose the draft flag', async () => {
    const { req, find } = mockReq({ comingSoon: ['beer-1'], payloadAPI: 'GraphQL' })
    expect(await callRead(canReadBeers, req)).toEqual(publishedOnly)
    expect(find).not.toHaveBeenCalled()
  })
})

describe('Beers readVersions', () => {
  it('limits version history to beer managers', () => {
    expect(callRead(Beers.access?.readVersions, { user: null })).toBe(false)
    expect(callRead(Beers.access?.readVersions, { user: userWith(['bartender']) })).toBe(false)
    expect(callRead(Beers.access?.readVersions, { user: userWith(['beer-manager']) })).toBe(true)
  })
})
