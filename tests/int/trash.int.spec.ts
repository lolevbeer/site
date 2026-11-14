/**
 * Trash (#368): admin deletes are recoverable, signed-out visitors can never
 * read a trashed document (REST accepts `?trash=true` from anyone), and the
 * slug and recipe-number checks still count trashed documents.
 */
import type { Access, PayloadRequest, SanitizedConfig, Where } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@/lib/ably/publish', () => ({ publishKioskInvalidate: vi.fn() }))

import { hideTrashFromVisitors } from '@/src/access/roles'
import { Beers } from '@/src/collections/Beers'
import { generateUniqueSlug } from '@/src/collections/utils/generateUniqueSlug'

const NOT_TRASHED: Where = { deletedAt: { exists: false } }
describe('hideTrashFromVisitors (base read rule)', () => {
  const args = (user: unknown, trash: boolean) =>
    ({
      req: { user, payload: { collections: { beers: { config: { trash } } } } },
      slug: 'beers',
    }) as unknown as Parameters<Access>[0]

  it('adds a not-trashed filter for signed-out visitors', async () => {
    expect(await hideTrashFromVisitors(args(null, true))).toEqual(NOT_TRASHED)
  })

  it('adds nothing where the collection has no trash (it has no deletedAt field)', async () => {
    expect(await hideTrashFromVisitors(args(null, false))).toBe(true)
  })

  it('leaves signed-in users to the collection rule, so staff can open the trash', async () => {
    expect(await hideTrashFromVisitors(args({ id: 'u1' }, true))).toBe(true)
  })
})

describe('collections', () => {
  let config: SanitizedConfig
  beforeAll(async () => {
    // Building the config only validates these; nothing connects to the database.
    vi.stubEnv('DATABASE_URI', process.env.DATABASE_URI || 'mongodb://127.0.0.1:27017/config-test')
    vi.stubEnv('PAYLOAD_SECRET', process.env.PAYLOAD_SECRET || 'config-test-secret')
    config = await (await import('@/src/payload.config')).default
  }, 60_000)

  const TRASH = [
    'beers',
    'menus',
    'events',
    'recurring-events',
    'jobs',
    'faqs',
    'food-vendors',
    'distributors',
    'event-inquiries',
    'donation-requests',
    'job-applications',
  ]

  it('have trash on exactly where staff delete by hand', () => {
    expect(
      config.collections
        .filter((c) => c.trash)
        .map((c) => c.slug)
        .sort(),
    ).toEqual([...TRASH].sort())
  })

  it.each(TRASH)('%s never shows a trashed document to a signed-out visitor', async (slug) => {
    const collection = config.collections.find((c) => c.slug === slug)!
    const visitor = {
      req: {
        user: null,
        query: {},
        payload: { config, collections: { [slug]: { config: collection } } },
      },
    } as unknown as Parameters<Access>[0]
    const result = await collection.access.read(visitor)
    // Either nobody signed out can read at all, or the rule carries the filter.
    if (result !== false) expect(JSON.stringify(result)).toContain(JSON.stringify(NOT_TRASHED))
  })
})

describe('uniqueness checks count trashed documents', () => {
  function mockReq() {
    const find = vi.fn(async (_args: Record<string, unknown>) => ({ docs: [] as unknown[] }))
    const req = { user: { id: 'u1' }, context: {}, payload: { find } } as unknown as PayloadRequest
    return { req, find }
  }

  it('generateUniqueSlug looks in the trash too', async () => {
    const { req, find } = mockReq()
    await generateUniqueSlug('Akko', 'beers', req)
    expect(find).toHaveBeenCalledTimes(2)
    for (const [args] of find.mock.calls) expect(args.trash).toBe(true)
  })

  it('the next recipe number and the recipe uniqueness check look in the trash too', async () => {
    const { req, find } = mockReq()
    const beforeChange = Beers.hooks!.beforeChange![0] as (args: Record<string, unknown>) => unknown
    await beforeChange({ data: { name: 'Akko', slug: 'akko' }, req, operation: 'create' })
    const recipeLookups = find.mock.calls.filter(([args]) => args.collection === 'beers')
    expect(recipeLookups).toHaveLength(2)
    for (const [args] of recipeLookups) expect(args.trash).toBe(true)
  })
})
