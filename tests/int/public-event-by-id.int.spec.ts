/**
 * getPublicEventById backs /events/<id>/calendar.ics. It looks one event up
 * directly (not by scanning the truncated upcoming list), reads anonymously so
 * private events and the internal description stay hidden, and rejects
 * malformed ids before querying.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
  revalidateTag: vi.fn(),
}))
vi.mock('@/lib/utils/date', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/utils/date')>()),
  getTodayEST: () => '2026-10-11',
}))

const payloadFind = vi.hoisted(() => vi.fn())
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ find: payloadFind })) }))
vi.mock('@/src/payload.config', () => ({ default: {} }))

import { getPublicEventById } from '@/lib/utils/payload-api'

const ONE_OFF_ID = '6650f1a2b3c4d5e6f7a8b9c0'
const DEF_ID = '6650f1a2b3c4d5e6f7a8b9c1'

const trivia = {
  id: DEF_ID,
  active: true,
  visibility: 'public',
  organizer: 'Trivia',
  year: 2026,
  day: 'wednesday',
  occurrences: ['first', 'second', 'third', 'fourth', 'fifth'],
  startTime: '7pm',
  location: { id: 'loc-1', slug: 'lawrenceville' },
}

beforeEach(() => {
  payloadFind.mockReset()
})

describe('getPublicEventById', () => {
  it('finds a one-off by id as an anonymous visitor, upcoming and public only', async () => {
    payloadFind.mockResolvedValue({ docs: [{ id: ONE_OFF_ID, organizer: 'Release' }] })
    await expect(getPublicEventById(ONE_OFF_ID)).resolves.toMatchObject({ id: ONE_OFF_ID })
    expect(payloadFind).toHaveBeenCalledTimes(1)
    expect(payloadFind.mock.calls[0][0]).toMatchObject({
      collection: 'events',
      overrideAccess: false,
      limit: 1,
    })
    const where = JSON.stringify(payloadFind.mock.calls[0][0].where)
    expect(where).toContain(ONE_OFF_ID)
    expect(where).toContain('"visibility":{"equals":"public"}')
    expect(where).toContain('2026-10-11T00:00:00.000Z')
  })

  it('expands just one recurring definition for a recurring-<def>-<date> id', async () => {
    payloadFind.mockImplementation(async ({ collection }: { collection: string }) =>
      collection === 'recurring-events' ? { docs: [trivia] } : { docs: [] },
    )
    const id = `recurring-${DEF_ID}-2026-12-30`
    await expect(getPublicEventById(id)).resolves.toMatchObject({ id, organizer: 'Trivia' })
    const defQuery = payloadFind.mock.calls.find(
      (call) => call[0].collection === 'recurring-events',
    )![0]
    expect(defQuery).toMatchObject({ overrideAccess: false, limit: 1 })
    expect(JSON.stringify(defQuery.where)).toContain(DEF_ID)
    for (const call of payloadFind.mock.calls)
      expect(call[0]).toMatchObject({ overrideAccess: false })
  })

  it('returns null for a recurring date the definition does not produce', async () => {
    payloadFind.mockImplementation(async ({ collection }: { collection: string }) =>
      collection === 'recurring-events' ? { docs: [trivia] } : { docs: [] },
    )
    // 2026-12-31 is a Thursday.
    await expect(getPublicEventById(`recurring-${DEF_ID}-2026-12-31`)).resolves.toBeNull()
  })

  it('returns null when a one-off overrides that recurring occurrence', async () => {
    payloadFind.mockImplementation(async ({ collection }: { collection: string }) =>
      collection === 'recurring-events'
        ? { docs: [trivia] }
        : {
            docs: [
              {
                id: ONE_OFF_ID,
                organizer: 'trivia',
                date: '2026-12-30T12:00:00.000Z',
                location: { id: 'loc-1' },
              },
            ],
          },
    )
    await expect(getPublicEventById(`recurring-${DEF_ID}-2026-12-30`)).resolves.toBeNull()
  })

  it('rejects malformed ids without querying', async () => {
    for (const id of ['nope', '../etc', `recurring-${DEF_ID}-12-30`, 'recurring-x-2026-12-30']) {
      await expect(getPublicEventById(id)).resolves.toBeNull()
    }
    expect(payloadFind).not.toHaveBeenCalled()
  })
})
