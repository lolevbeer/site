/**
 * The "Recurring food" block above the Food Bookings list: grid slots grouped
 * into one row per vendor, taproom, weekday and season.
 */
import { describe, expect, it, vi } from 'vitest'
import type { FoodVendor, Location } from '@/src/payload-types'
import {
  recurringFoodRows,
  type RecurringFoodSlot,
} from '@/src/components/admin/recurring-series-cells'

const lawrenceville = { id: 'law', name: 'Lawrenceville' } as Location
const zelienople = { id: 'zel', name: 'Zelienople' } as Location
const pierogi = { id: 'pie', name: 'Pierogi Truck' } as FoodVendor
const tacos = { id: 'taco', name: 'Taco Bus' } as FoodVendor

const slot = (id: string, over: Partial<RecurringFoodSlot> = {}): RecurringFoodSlot => ({
  id,
  year: 2026,
  day: 'friday',
  occurrence: 'first',
  vendor: pierogi,
  location: lawrenceville,
  ...over,
})

const options = {
  href: '/admin/globals/recurring-food',
  columns: ['_select', 'vendor', 'date', 'location'],
  onError: () => {},
}

describe('recurring food rows', () => {
  it('groups one vendor’s slots on a weekday into one row with the pattern', () => {
    const rows = recurringFoodRows(
      [slot('a', { occurrence: 'third' }), slot('b', { occurrence: 'first' })],
      { ...options, columns: ['_select', 'vendor', 'date', 'location', 'startTime'] },
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      href: '/admin/globals/recurring-food',
      title: 'Pierogi Truck',
      paused: false,
      cells: {
        _select: '',
        vendor: 'Pierogi Truck',
        date: 'First & Third Friday · 2026',
        location: 'Lawrenceville',
        startTime: '',
      },
    })
  })

  it('keeps taprooms, weekdays, seasons and vendors apart, ordered by season, taproom, weekday', () => {
    const rows = recurringFoodRows(
      [
        slot('z', { location: zelienople }),
        slot('y', { year: 2027 }),
        slot('s', { day: 'saturday', vendor: tacos }),
        slot('f'),
        slot('t', { vendor: tacos, occurrence: 'second' }),
      ],
      options,
    )

    expect(rows.map((row) => `${row.cells.date} ${row.cells.location} ${row.title}`)).toEqual([
      'First Friday · 2026 Lawrenceville Pierogi Truck',
      'Second Friday · 2026 Lawrenceville Taco Bus',
      'First Saturday · 2026 Lawrenceville Taco Bus',
      'First Friday · 2026 Zelienople Pierogi Truck',
      'First Friday · 2027 Lawrenceville Pierogi Truck',
    ])
    expect(new Set(rows.map((row) => row.id)).size).toBe(5)
  })

  it('names an unreadable vendor or taproom (a bare ID) as blank, never the ID', () => {
    const [row] = recurringFoodRows([slot('a', { vendor: 'pie', location: 'law' })], options)

    expect(row.cells).toMatchObject({ vendor: '', location: '' })
    expect(row.title).toBe('Unknown vendor')
  })

  it('shows a slot whose vendor was trashed (populated as null) as an unknown vendor', () => {
    const trashed = slot('a', { vendor: null as unknown as string })

    const [row] = recurringFoodRows([trashed], options)

    expect(row).toMatchObject({ title: 'Unknown vendor', cells: { vendor: '' } })
  })

  it('leaves out a group it cannot format and reports it, keeping the rest', () => {
    const onError = vi.fn()
    const broken = slot('x', { day: null as unknown as 'friday', vendor: tacos })

    const rows = recurringFoodRows([broken, slot('a')], { ...options, onError })

    expect(rows.map((row) => row.title)).toEqual(['Pierogi Truck'])
    expect(onError).toHaveBeenCalledWith(expect.any(Error), expect.any(String))
  })
})
