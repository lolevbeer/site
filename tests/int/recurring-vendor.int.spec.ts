/**
 * The Event and Food date warnings both ask "which recurring food vendor is
 * scheduled at this location on this date?". They share one lookup, keyed on
 * the editor's local calendar date for the weekday, the week of the month, the
 * schedule year, and exclusions alike.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const actions = vi.hoisted(() => ({
  getRecurringFoodData: vi.fn(),
  getFoodVendor: vi.fn(),
}))
vi.mock('@/src/actions/admin-data', () => actions)

import { getRecurringVendorName } from '@/src/components/admin/recurring-vendor'

// Friday 2 Oct 2026 is the first Friday of the month. Local-time constructors
// keep the calendar date the same in any test timezone.
const firstFriday = new Date(2026, 9, 2, 23, 30)

beforeEach(() => {
  vi.clearAllMocks()
  actions.getRecurringFoodData.mockResolvedValue({
    year: 2026,
    schedules: { loc1: { friday: { first: 'vendor1' } } },
    exclusions: { loc1: [] },
  })
  actions.getFoodVendor.mockResolvedValue({ id: 'vendor1', name: 'Taco Truck' })
})

describe('getRecurringVendorName', () => {
  it("names the vendor scheduled for the date's weekday and week of the month", async () => {
    await expect(getRecurringVendorName(firstFriday, 'loc1')).resolves.toBe('Taco Truck')
    expect(actions.getRecurringFoodData).toHaveBeenCalledWith(2026)
    expect(actions.getFoodVendor).toHaveBeenCalledWith('vendor1')
  })

  it('is null when nothing is scheduled in that slot', async () => {
    await expect(getRecurringVendorName(new Date(2026, 9, 9), 'loc1')).resolves.toBeNull()
    await expect(getRecurringVendorName(firstFriday, 'loc2')).resolves.toBeNull()
    expect(actions.getFoodVendor).not.toHaveBeenCalled()
  })

  it('is null on an excluded date, matched by the local calendar date even late in the evening', async () => {
    actions.getRecurringFoodData.mockResolvedValue({
      year: 2026,
      schedules: { loc1: { friday: { first: 'vendor1' } } },
      exclusions: { loc1: ['2026-10-02'] },
    })
    await expect(getRecurringVendorName(firstFriday, 'loc1')).resolves.toBeNull()
  })

  it('falls back to a placeholder name when the vendor cannot be read', async () => {
    actions.getFoodVendor.mockResolvedValue(null)
    await expect(getRecurringVendorName(firstFriday, 'loc1')).resolves.toBe('Unknown vendor')
  })
})
