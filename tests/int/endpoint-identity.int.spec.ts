/**
 * Admin endpoints act as the user they authorized.
 *
 * Every Local API call inside the custom admin endpoints must pass
 * `overrideAccess: false` plus the resolved `user`, so collection and field
 * access rules decide what the call may do. The user comes from `req.user`
 * or, when Payload did not populate it (some SSE requests on Vercel), from
 * `getUserFromRequest` — so the tests cover both sources.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PayloadHandler, PayloadRequest } from 'payload'
import type { User } from '@/src/payload-types'
import { DEFAULT_REGION_COORDS } from '@/src/utils/distributor-region-coords'

const getUserFromRequest = vi.fn()
vi.mock('@/src/endpoints/auth-helper', () => ({
  getUserFromRequest: (...args: unknown[]) => getUserFromRequest(...args),
}))

vi.mock('@/src/endpoints/geocode', () => ({
  geocode: vi.fn(async () => [-80, 40.5] as [number, number]),
  geocodeAddress: vi.fn(async () => ({ coords: [-80, 40.5], source: 'Nominatim' })),
  geocodeFallback: vi.fn(async () => null),
}))

vi.mock('@/src/utils/async', () => ({ sleep: vi.fn(async () => undefined) }))

vi.mock('@/src/utils/untappd', () => ({
  fetchUntappdData: vi.fn(async () => ({ rating: 4.1, ratingCount: 10, positiveReviews: [] })),
}))

const admin: User = {
  id: 'admin-id',
  collection: 'users',
  email: 'admin@example.com',
  roles: ['admin'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

type Calls = Record<
  'find' | 'findGlobal' | 'update' | 'create' | 'updateGlobal',
  ReturnType<typeof vi.fn>
>

function mockPayload(findDocs: unknown[]): Calls {
  return {
    find: vi.fn(async () => ({ docs: findDocs })),
    findGlobal: vi.fn(async () => ({ distributorOhUrl: 'https://example.com/oh.json' })),
    update: vi.fn(async () => ({})),
    create: vi.fn(async (args: { data: Record<string, unknown> }) => ({ id: 'new', ...args.data })),
    updateGlobal: vi.fn(async () => ({})),
  }
}

function makeReq(
  payload: Calls,
  reqUser: User | null,
  url: string,
  extra: Partial<PayloadRequest> = {},
): PayloadRequest {
  return {
    payload,
    user: reqUser,
    url,
    headers: new Headers(),
    ...extra,
  } as unknown as PayloadRequest
}

/** Run the handler and drain any SSE body so streamed calls finish. */
async function run(handler: PayloadHandler, req: PayloadRequest) {
  const res = await handler(req)
  await res.text()
  return res
}

function localApiCalls(payload: Calls) {
  return Object.entries(payload).flatMap(([op, fn]) =>
    fn.mock.calls.map((call) => ({ op, args: call[0] as Record<string, unknown> })),
  )
}

function expectActsAs(payload: Calls, user: User, expectedOps: string[]) {
  const calls = localApiCalls(payload)
  expect(calls.map((c) => c.op).sort()).toEqual([...expectedOps].sort())
  for (const { op, args } of calls) {
    expect({ op, overrideAccess: args.overrideAccess, user: args.user }).toEqual({
      op,
      overrideAccess: false,
      user,
    })
  }
}

interface Case {
  name: string
  load: () => Promise<PayloadHandler>
  findDocs: unknown[]
  url: string
  extra?: Partial<PayloadRequest>
  setup?: () => void
  ops: string[]
}

const suspiciousPA = {
  id: 'd1',
  name: 'Store',
  address: '1 Main',
  city: 'Pittsburgh',
  state: 'PA',
  zip: '15201',
  region: 'PA',
  location: DEFAULT_REGION_COORDS.PA,
}

const cases: Case[] = [
  {
    name: 'recalculate-beer-prices',
    load: async () =>
      (await import('@/src/endpoints/recalculate-beer-prices')).recalculateBeerPrices,
    findDocs: [{ id: 'b1', name: 'Beer', draftPrice: 7, fourPack: 18 }],
    url: 'http://localhost/api/recalculate',
    ops: ['find', 'update'],
  },
  {
    name: 'update-distributor-urls',
    load: async () =>
      (await import('@/src/endpoints/update-distributor-urls')).updateDistributorUrls,
    findDocs: [],
    url: 'http://localhost/api/urls',
    extra: {
      json: async () => ({ distributorPaUrl: 'https://pa', distributorOhUrl: 'https://oh' }),
    } as Partial<PayloadRequest>,
    ops: ['updateGlobal'],
  },
  {
    name: 'import-distributors',
    load: async () => (await import('@/src/endpoints/import-distributors')).importDistributors,
    // Existing "Store" in OH with an old address → update; "New Place" → create.
    findDocs: [{ ...suspiciousPA, region: 'OH', state: 'OH', address: 'Old St' }],
    url: 'http://localhost/api/import?region=oh',
    setup: () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () =>
            new Response(
              JSON.stringify({
                Export: {
                  Table: {
                    Row: [
                      { CustomerName: 'Store', AddressCityStateZip: '1 Main, Columbus, OH 43215' },
                      {
                        CustomerName: 'New Place',
                        AddressCityStateZip: '2 Oak, Columbus, OH 43215',
                      },
                    ],
                  },
                },
              }),
            ),
        ),
      )
    },
    ops: ['findGlobal', 'find', 'update', 'create'],
  },
  {
    name: 'import-distributors-csv',
    load: async () =>
      (await import('@/src/endpoints/import-distributors-csv')).importDistributorsCsv,
    findDocs: [{ ...suspiciousPA, region: 'NY', state: 'NY', address: 'Old St', phone: '' }],
    url: 'http://localhost/api/csv',
    extra: {
      formData: async () => {
        const form = new FormData()
        const csv = [
          'name,address,city,state,zip',
          'Store,1 Main,Rochester,NY,14604',
          'New Place,2 Oak,Rochester,NY,14604',
        ].join('\n')
        form.set('file', new File([csv], 'd.csv'))
        return form
      },
    } as unknown as Partial<PayloadRequest>,
    ops: ['find', 'update', 'create'],
  },
  {
    name: 'regeocode-distributors',
    load: async () =>
      (await import('@/src/endpoints/regeocode-distributors')).regeocodeDistributors,
    findDocs: [suspiciousPA],
    url: 'http://localhost/api/regeocode',
    ops: ['find', 'update'],
  },
  {
    name: 'sync-untappd-ratings',
    load: async () => (await import('@/src/endpoints/sync-untappd-ratings')).syncUntappdRatings,
    findDocs: [{ id: 'b1', name: 'Beer', untappd: '/b/lolev-beer/123' }],
    url: 'http://localhost/api/sync',
    ops: ['find', 'update'],
  },
]

describe.each(cases)('$name acts as the authorized user', (c) => {
  beforeEach(() => {
    getUserFromRequest.mockReset()
    vi.unstubAllGlobals()
    c.setup?.()
  })

  it('passes overrideAccess: false and req.user to every Local API call', async () => {
    const payload = mockPayload(c.findDocs)
    const res = await run(await c.load(), makeReq(payload, admin, c.url, c.extra))
    expect(res.status).toBe(200)
    expect(getUserFromRequest).not.toHaveBeenCalled()
    expectActsAs(payload, admin, c.ops)
  })

  it('passes the fallback user when req.user is null', async () => {
    const fallbackAdmin = { ...admin, id: 'fallback-admin' }
    getUserFromRequest.mockResolvedValue(fallbackAdmin)
    const payload = mockPayload(c.findDocs)
    const res = await run(await c.load(), makeReq(payload, null, c.url, c.extra))
    expect(res.status).toBe(200)
    expect(getUserFromRequest).toHaveBeenCalled()
    expectActsAs(payload, fallbackAdmin, c.ops)
  })
})
