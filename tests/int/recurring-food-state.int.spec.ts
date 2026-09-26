import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import type { User } from '@/src/payload-types'
import { getRecurringFoodState } from '@/src/utils/recurring-food'

vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
  revalidateTag: vi.fn(),
}))
vi.mock('@/lib/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))
const mockPayload = { find: vi.fn(), findGlobal: vi.fn() }
vi.mock('payload', () => ({ getPayload: vi.fn(async () => mockPayload) }))
vi.mock('@/src/payload.config', () => ({ default: {} }))

import { getCombinedUpcomingFood } from '@/lib/utils/payload-api'

const anonymous = { overrideAccess: false } as const

describe('recurring food compatibility reads', () => {
  it('uses legacy JSON until the migration marker is present', async () => {
    const findGlobal = vi.fn(async () => ({
      normalizedAt: null,
      schedules: { 'location-1': { monday: { first: 'legacy-vendor' } } },
      exclusions: { 'location-1': ['2026-08-31'] },
    }))
    const find = vi.fn(async () => ({
      docs: [
        {
          location: 'location-1',
          vendor: 'native-vendor',
          day: 'monday',
          occurrence: 'first',
          active: true,
        },
      ],
    }))

    const state = await getRecurringFoodState({ findGlobal, find } as unknown as Payload, anonymous)

    expect(state.usingLegacyData).toBe(true)
    expect(state.schedules['location-1'].monday.first).toBe('legacy-vendor')
  })

  it('reconstructs the grid shape from normalized schedule and exclusion rows', async () => {
    const findGlobal = vi.fn(async () => ({ normalizedAt: '2026-08-26T00:00:00.000Z' }))
    const find = vi
      .fn()
      .mockResolvedValueOnce({
        docs: [
          {
            location: 'location-1',
            vendor: 'vendor-1',
            day: 'monday',
            occurrence: 'first',
            active: true,
          },
        ],
      })
      .mockResolvedValueOnce({
        docs: [{ location: 'location-1', date: '2026-08-31T12:00:00.000Z' }],
      })

    const state = await getRecurringFoodState({ findGlobal, find } as unknown as Payload, anonymous)

    expect(state.usingLegacyData).toBe(false)
    expect(state.schedules['location-1'].monday.first).toBe('vendor-1')
    expect(state.exclusions['location-1']).toEqual(['2026-08-31'])
  })

  it('filters inactive schedules in the query so the row cap counts live rows only', async () => {
    // Filtering after the fetch let archived rows consume the 1000-row limit
    // and crowd out active schedules once a location had enough history.
    const findGlobal = vi.fn(async () => ({ normalizedAt: '2026-08-26T00:00:00.000Z' }))
    const find = vi.fn().mockResolvedValueOnce({ docs: [] }).mockResolvedValueOnce({ docs: [] })

    await getRecurringFoodState({ findGlobal, find } as unknown as Payload, anonymous)

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'recurring-food-schedules',
        where: {
          and: [
            { active: { equals: true } },
            // 2026 also matches legacy rows that predate the year field.
            { or: [{ year: { equals: 2026 } }, { year: { exists: false } }] },
          ],
        },
      }),
    )
  })

  it('loads only the requested year so schedules cannot leak across December', async () => {
    const findGlobal = vi.fn(async () => ({ normalizedAt: '2026-08-26T00:00:00.000Z' }))
    const find = vi.fn().mockResolvedValueOnce({ docs: [] }).mockResolvedValueOnce({ docs: [] })

    const state = await getRecurringFoodState({ findGlobal, find } as unknown as Payload, {
      ...anonymous,
      year: 2027,
    })

    expect(state.year).toBe(2027)
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'recurring-food-schedules',
        where: {
          and: [{ active: { equals: true } }, { year: { equals: 2027 } }],
        },
      }),
    )
  })
})

/**
 * Payload 3.x Local API treats an omitted or undefined `overrideAccess` as
 * true, so each inner read must receive the caller's value literally.
 */
describe('recurring food access identity', () => {
  function normalizedPayload() {
    const findGlobal = vi.fn(async () => ({ normalizedAt: '2026-08-26T00:00:00.000Z' }))
    const find = vi.fn(async () => ({ docs: [] }))
    return { findGlobal, find, payload: { findGlobal, find } as unknown as Payload }
  }

  function innerCalls(findGlobal: ReturnType<typeof vi.fn>, find: ReturnType<typeof vi.fn>) {
    return [...findGlobal.mock.calls, ...find.mock.calls].map(
      (call) => call[0] as Record<string, unknown>,
    )
  }

  it('passes overrideAccess: false to every read for an anonymous caller', async () => {
    const { findGlobal, find, payload } = normalizedPayload()

    await getRecurringFoodState(payload, anonymous)

    const calls = innerCalls(findGlobal, find)
    expect(calls).toHaveLength(3)
    for (const args of calls) expect(args.overrideAccess).toBe(false)
  })

  it('forwards overrideAccess and user exactly as passed', async () => {
    const { findGlobal, find, payload } = normalizedPayload()
    const user = { id: 'user-1' } as unknown as User

    await getRecurringFoodState(payload, { overrideAccess: false, user })

    for (const args of innerCalls(findGlobal, find)) {
      expect(args).toHaveProperty('overrideAccess', false)
      expect(args.user).toBe(user)
    }
  })

  it('public recurring food expansion reads as anonymous, not with override', async () => {
    mockPayload.find.mockReset()
    mockPayload.findGlobal.mockReset()
    mockPayload.find.mockImplementation(async ({ collection }: { collection: string }) =>
      collection === 'locations' ? { docs: [{ id: 'loc-1' }] } : { docs: [] },
    )
    mockPayload.findGlobal.mockResolvedValue({ normalizedAt: '2026-08-26T00:00:00.000Z' })

    await getCombinedUpcomingFood('lawrenceville')

    const recurringReads = [...mockPayload.findGlobal.mock.calls, ...mockPayload.find.mock.calls]
      .map((call) => call[0] as Record<string, unknown>)
      .filter((args) =>
        ['recurring-food', 'recurring-food-schedules', 'recurring-food-exclusions'].includes(
          String(args.slug ?? args.collection),
        ),
      )
    expect(recurringReads.length).toBeGreaterThan(0)
    for (const args of recurringReads) expect(args.overrideAccess).toBe(false)
  })
})
