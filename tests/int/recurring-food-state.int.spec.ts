import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { getRecurringFoodState } from '@/src/utils/recurring-food'

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

    const state = await getRecurringFoodState({ findGlobal, find } as unknown as Payload)

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

    const state = await getRecurringFoodState({ findGlobal, find } as unknown as Payload)

    expect(state.usingLegacyData).toBe(false)
    expect(state.schedules['location-1'].monday.first).toBe('vendor-1')
    expect(state.exclusions['location-1']).toEqual(['2026-08-31'])
  })

  it('filters inactive schedules in the query so the row cap counts live rows only', async () => {
    // Filtering after the fetch let archived rows consume the 1000-row limit
    // and crowd out active schedules once a location had enough history.
    const findGlobal = vi.fn(async () => ({ normalizedAt: '2026-08-26T00:00:00.000Z' }))
    const find = vi.fn().mockResolvedValueOnce({ docs: [] }).mockResolvedValueOnce({ docs: [] })

    await getRecurringFoodState({ findGlobal, find } as unknown as Payload)

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'recurring-food-schedules',
        where: { active: { equals: true } },
      }),
    )
  })
})
