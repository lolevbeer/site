/**
 * getWeeklyHoursWithHolidays week window.
 *
 * - HolidayHours dates are stored at noon UTC (`2027-03-28T12:00:00.000Z`), so
 *   the week's holiday query must include all of Sunday, not stop at a bare
 *   `YYYY-MM-DD` key (which Mongo compares as Sunday midnight UTC).
 * - The week is the brewery's (America/New_York) week: late Sunday evening,
 *   when UTC is already Monday, still shows the current Mon–Sun week.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Production (Vercel) runs in UTC; model that regardless of the dev machine.
const originalTZ = process.env.TZ
process.env.TZ = 'UTC'
afterAll(() => {
  process.env.TZ = originalTZ
})

vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
  revalidateTag: vi.fn(),
}))
vi.mock('@/lib/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const find = vi.fn()
vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({ find })),
}))
vi.mock('@/src/payload.config', () => ({ default: {} }))

import { getWeeklyHoursWithHolidays } from '@/lib/utils/payload-api'

type Where = { and: Array<{ date?: Record<string, string> }> }

/** Minimal Mongo-style evaluation of the holiday query's date bounds. */
function matchesDate(where: Where, stored: string): boolean {
  const value = new Date(stored).getTime()
  return where.and.every(({ date }) => {
    if (!date) return true
    return Object.entries(date).every(([op, bound]) => {
      const b = new Date(bound).getTime()
      if (op === 'greater_than_equal') return value >= b
      if (op === 'greater_than') return value > b
      if (op === 'less_than_equal') return value <= b
      if (op === 'less_than') return value < b
      throw new Error(`unexpected operator ${op}`)
    })
  })
}

const easter = {
  id: 'h-1',
  name: 'Easter',
  date: '2027-03-28T12:00:00.000Z',
  type: 'closed',
  locations: ['loc-1'],
}

beforeEach(() => {
  find.mockReset()
  find.mockImplementation(async (args: { collection: string; where: Where }) => {
    if (args.collection === 'locations') {
      return { docs: [{ id: 'loc-1', timezone: 'America/New_York' }] }
    }
    return { docs: [easter].filter((h) => matchesDate(args.where, h.date)) }
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('getWeeklyHoursWithHolidays', () => {
  it('includes a Sunday holiday stored at noon UTC', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    // Wednesday March 24, 2027, midday ET.
    vi.setSystemTime(new Date('2027-03-24T16:00:00.000Z'))

    const week = await getWeeklyHoursWithHolidays('loc-sunday-noon')
    const sunday = week.find((d) => d.day === 'sunday')

    expect(sunday?.holidayName).toBe('Easter')
    expect(sunday?.closed).toBe(true)
  })

  it('keeps the current ET week at 11:30 PM Sunday (already Monday in UTC)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    // Sunday March 28, 2027, 23:30 EDT = Monday 03:30 UTC.
    vi.setSystemTime(new Date('2027-03-29T03:30:00.000Z'))

    const week = await getWeeklyHoursWithHolidays('loc-late-sunday')

    const dates = week.map(
      (d) => `${d.date.getFullYear()}-${d.date.getMonth() + 1}-${d.date.getDate()}`,
    )
    expect(dates[0]).toBe('2027-3-22')
    expect(dates[6]).toBe('2027-3-28')
    expect(week[6].holidayName).toBe('Easter')
  })
})
