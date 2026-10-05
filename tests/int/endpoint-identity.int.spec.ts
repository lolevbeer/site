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

const getUserFromRequest = vi.fn()
vi.mock('@/src/endpoints/auth-helper', () => ({
  getUserFromRequest: (...args: unknown[]) => getUserFromRequest(...args),
}))

const geocodeDistributor = vi.fn(async () => [-80, 40.5] as [number, number] | null)
vi.mock('@/src/endpoints/geocode', () => ({
  geocodeDistributor: (...a: unknown[]) => geocodeDistributor(...(a as [])),
}))

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
    findGlobal: vi.fn(async () => ({
      distributorOhUrl: 'https://sixthcity.encompass8.com/oh.json',
    })),
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

const existingPA = {
  id: 'd1',
  name: 'Store',
  address: '1 Main',
  city: 'Pittsburgh',
  state: 'PA',
  zip: '15201',
  region: 'PA',
  location: [-79.9959, 40.4406],
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
      json: async () => ({
        distributorPaUrl: 'https://sixthcity.encompass8.com/pa',
        distributorOhUrl: 'https://sixthcity.encompass8.com/oh',
      }),
    } as Partial<PayloadRequest>,
    ops: ['updateGlobal'],
  },
  {
    name: 'import-distributors',
    load: async () => (await import('@/src/endpoints/import-distributors')).importDistributors,
    // Existing "Store" in OH with an old address → update; "New Place" → create.
    findDocs: [{ ...existingPA, region: 'OH', state: 'OH', address: 'Old St' }],
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
    findDocs: [{ ...existingPA, region: 'NY', state: 'NY', address: 'Old St', phone: '' }],
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

describe('import-distributors when a row cannot be geocoded', () => {
  it('reports the row as an error and does not create it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              Export: {
                Table: {
                  Row: [
                    { CustomerName: 'Nowhere', AddressCityStateZip: '2 Oak, Columbus, OH 43215' },
                  ],
                },
              },
            }),
          ),
      ),
    )
    geocodeDistributor.mockResolvedValueOnce(null)
    const payload = mockPayload([])
    const handler = (await import('@/src/endpoints/import-distributors')).importDistributors
    const res = await run(handler, makeReq(payload, admin, 'http://localhost/api/import?region=oh'))
    expect(res.status).toBe(200)
    expect(payload.create).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})

it('rejects unsafe distributor destinations before fetching and disallows redirects without leaking errors', async () => {
  const { importDistributors } = await import('@/src/endpoints/import-distributors')
  const payload = mockPayload([])
  const fetchMock = vi.fn().mockRejectedValue(new Error('redirect contained PRIVATE RESPONSE'))
  vi.stubGlobal('fetch', fetchMock)
  try {
    payload.findGlobal.mockResolvedValueOnce({ distributorOhUrl: 'https://127.0.0.1/private' })
    expect(
      (await importDistributors(makeReq(payload, admin, 'http://localhost/api/import'))).status,
    ).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
    const response = await importDistributors(
      makeReq(payload, admin, 'http://localhost/api/import'),
    )
    expect(response.status).toBe(400)
    expect(await response.text()).not.toContain('PRIVATE RESPONSE')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://sixthcity.encompass8.com/oh.json',
      expect.objectContaining({ redirect: 'error', signal: expect.any(AbortSignal) }),
    )
    expect(payload.create).not.toHaveBeenCalled()
  } finally {
    vi.unstubAllGlobals()
  }
})
