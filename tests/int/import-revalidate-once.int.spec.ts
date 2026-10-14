/**
 * Distributor imports refresh the beer-map cache once, after the loop.
 *
 * Per-write revalidation hooks fired from inside the SSE stream throw
 * "static generation store missing" (the request context is gone once the
 * handler has returned the stream), so 53 imported venues never reached
 * /beer-map until a normal admin save. Each import write now passes
 * `skipRevalidate`, and the handler schedules one `revalidateForCollection`
 * with `after()`, which runs once the stream has finished, inside the request
 * context. A dry run, or an import that wrote nothing, refreshes nothing.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PayloadHandler, PayloadRequest } from 'payload'
import type { User } from '@/src/payload-types'

vi.mock('@/src/endpoints/auth-helper', () => ({ getUserFromRequest: vi.fn() }))
vi.mock('@/src/endpoints/geocode', () => ({
  geocodeDistributor: vi.fn(async () => [-80, 40.5]),
  resolveDistributor: vi.fn(async () => ({
    coords: [4.89, 52.37],
    parts: { city: 'Amsterdam', country: 'NL' },
    source: 'Mapbox',
    uncertain: false,
  })),
  reverseDistributor: vi.fn(async () => null),
}))
const revalidateForCollection = vi.fn()
// The real helper defers with `after`; here its callbacks run once the stream has
// been drained, which is the same order.
const afterCallbacks: (() => unknown)[] = []
vi.mock('@/src/plugins/revalidation-plugin', () => ({
  revalidateForCollectionAfterResponse: (slug: string, shouldRun: () => boolean) =>
    afterCallbacks.push(() => shouldRun() && revalidateForCollection(slug)),
}))

const admin = { id: 'admin-id', collection: 'users', roles: ['admin'] } as unknown as User

function mockPayload(existing: unknown[] = []) {
  return {
    find: vi.fn(async () => ({ docs: existing })),
    findGlobal: vi.fn(async () => ({ distributorOhUrl: 'https://example.com/oh.json' })),
    update: vi.fn(async () => ({})),
    create: vi.fn(async (args: { data: Record<string, unknown> }) => ({ id: 'new', ...args.data })),
  }
}

/** Run the handler, drain the SSE body, then run what it scheduled with `after`. */
async function run(handler: PayloadHandler, req: PayloadRequest) {
  const res = await handler(req)
  await res.text()
  while (afterCallbacks.length) await afterCallbacks.shift()!()
  return res
}

function csvReq(payload: ReturnType<typeof mockPayload>, csv: string, dryRun = false) {
  const form = new FormData()
  form.set('file', new File([csv], 'd.csv', { type: 'text/csv' }))
  if (dryRun) form.set('dryRun', 'true')
  return {
    payload,
    user: admin,
    url: 'http://localhost/api/import-distributors-csv',
    headers: new Headers(),
    formData: async () => form,
  } as unknown as PayloadRequest
}

const writes = (payload: ReturnType<typeof mockPayload>) => [
  ...payload.create.mock.calls,
  ...payload.update.mock.calls,
]

beforeEach(() => {
  afterCallbacks.length = 0
  revalidateForCollection.mockReset()
  vi.unstubAllGlobals()
})

describe('distributor CSV import', () => {
  const load = async () =>
    (await import('@/src/endpoints/import-distributors-csv')).importDistributorsCsv
  const csv =
    'name,address,city,state,zip,phone\n' +
    'Planet Wine,2004 Mt Vernon Ave,Alexandria,VA,22301,\n' +
    'Corks,7110 Patterson Ave,Richmond,VA,23229,\n'

  it('skips per-write revalidation and refreshes distributors once at the end', async () => {
    const payload = mockPayload()
    await run(await load(), csvReq(payload, csv))
    expect(payload.create).toHaveBeenCalledTimes(2)
    for (const [args] of writes(payload)) {
      expect(args).toMatchObject({ context: { skipRevalidate: true } })
    }
    expect(revalidateForCollection).toHaveBeenCalledTimes(1)
    expect(revalidateForCollection).toHaveBeenCalledWith('distributors')
  })

  it('also skips per-write revalidation on an update', async () => {
    const existing = { id: 'd1', name: 'Planet Wine', address: 'Old St', region: 'VA', state: 'VA' }
    const payload = mockPayload([existing])
    await run(await load(), csvReq(payload, csv))
    expect(payload.update).toHaveBeenCalled()
    for (const [args] of writes(payload)) {
      expect(args).toMatchObject({ context: { skipRevalidate: true } })
    }
    expect(revalidateForCollection).toHaveBeenCalledTimes(1)
  })

  it('does not refresh before the stream has finished writing', async () => {
    const payload = mockPayload()
    const res = await (await load())(csvReq(payload, csv))
    expect(revalidateForCollection).not.toHaveBeenCalled()
    await res.text()
    afterCallbacks.length = 0
  })

  it('refreshes nothing on a dry run', async () => {
    const payload = mockPayload()
    await run(await load(), csvReq(payload, csv, true))
    expect(writes(payload)).toEqual([])
    expect(revalidateForCollection).not.toHaveBeenCalled()
  })

  it('refreshes nothing when no row was written', async () => {
    const unchanged = {
      id: 'd1',
      name: 'Planet Wine',
      address: '2004 Mt Vernon Ave',
      city: 'Alexandria',
      state: 'VA',
      zip: '22301',
      phone: '',
      region: 'VA',
    }
    const payload = mockPayload([unchanged])
    await run(
      await load(),
      csvReq(
        payload,
        'name,address,city,state,zip,phone\nPlanet Wine,2004 Mt Vernon Ave,Alexandria,VA,22301,\n',
      ),
    )
    expect(writes(payload)).toEqual([])
    expect(revalidateForCollection).not.toHaveBeenCalled()
  })
})

describe('distributor feed import (PA/OH)', () => {
  it('skips per-write revalidation and refreshes distributors once at the end', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              Export: {
                Table: {
                  Row: [
                    { CustomerName: 'A', AddressCityStateZip: '1 Oak, Columbus, OH 43215' },
                    { CustomerName: 'B', AddressCityStateZip: '2 Oak, Columbus, OH 43215' },
                  ],
                },
              },
            }),
          ),
      ),
    )
    const payload = mockPayload()
    const handler = (await import('@/src/endpoints/import-distributors')).importDistributors
    await run(handler, {
      payload,
      user: admin,
      url: 'http://localhost/api/import?region=oh',
      headers: new Headers(),
    } as unknown as PayloadRequest)
    expect(payload.create).toHaveBeenCalledTimes(2)
    for (const [args] of writes(payload)) {
      expect(args).toMatchObject({ context: { skipRevalidate: true } })
    }
    expect(revalidateForCollection).toHaveBeenCalledTimes(1)
    expect(revalidateForCollection).toHaveBeenCalledWith('distributors')
  })
})
