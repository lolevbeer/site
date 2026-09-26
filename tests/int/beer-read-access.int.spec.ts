/**
 * Read access for the Beers collection: which roles see every beer, the
 * published-only rule for everyone else (drafts never show publicly), and the
 * draft guard that keeps unpublished edits of published beers private.
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
  query?: Record<string, unknown>
  data?: Record<string, unknown>
  payloadAPI?: 'GraphQL' | 'local' | 'REST'
}

function mockReq({ user = null, query = {}, data, payloadAPI = 'local' }: MockReqOptions = {}) {
  const find = vi.fn(async () => ({ docs: [] }))
  const findGlobal = vi.fn(async () => ({ beers: [] }))
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
      const { req } = mockReq({ user: userWith([role]) })
      expect(await callRead(canReadBeers, req)).toBe(true)
    },
  )

  it('limits anonymous visitors to published beers', async () => {
    const { req } = mockReq()
    expect(await callRead(canReadBeers, req)).toEqual(publishedOnly)
  })

  it('limits other signed-in roles to published beers', async () => {
    const { req } = mockReq({ user: userWith(['event-manager']) })
    expect(await callRead(canReadBeers, req)).toEqual(publishedOnly)
  })

  it('never looks up menus or Coming Soon for anonymous visitors', async () => {
    const { req, find, findGlobal } = mockReq()
    await callRead(canReadBeers, req)
    expect(find).not.toHaveBeenCalled()
    expect(findGlobal).not.toHaveBeenCalled()
  })

  it.each([
    ['REST find (query parsed to boolean)', { query: { draft: true }, payloadAPI: 'REST' }],
    ['REST findByID (raw query string)', { query: { draft: 'true' }, payloadAPI: 'REST' }],
    ['REST method-override body', { data: { draft: true }, payloadAPI: 'REST' }],
  ] as const)('denies anonymous draft reads: %s', async (_label, options) => {
    const { req } = mockReq(options)
    expect(await callRead(canReadBeers, req)).toBe(false)
  })

  it('still lets full-read roles read drafts', async () => {
    const { req } = mockReq({ user: userWith(['bartender']), query: { draft: 'true' } })
    expect(await callRead(canReadBeers, req)).toBe(true)
  })

  it('keeps GraphQL to published beers, since GraphQL does not expose the draft flag', async () => {
    const { req } = mockReq({ payloadAPI: 'GraphQL' })
    expect(await callRead(canReadBeers, req)).toEqual(publishedOnly)
  })
})

describe('Beers readVersions', () => {
  it('limits version history to beer managers', () => {
    expect(callRead(Beers.access?.readVersions, { user: null })).toBe(false)
    expect(callRead(Beers.access?.readVersions, { user: userWith(['bartender']) })).toBe(false)
    expect(callRead(Beers.access?.readVersions, { user: userWith(['beer-manager']) })).toBe(true)
  })
})
