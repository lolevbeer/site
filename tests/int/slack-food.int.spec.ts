import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import type { User } from '@/src/payload-types'
import { findUpcomingSlackFood } from '@/lib/slack/upcoming-food'

const user = { id: 'bartender', roles: ['bartender'] } as User
const location = { id: 'lawrenceville', name: 'Lawrenceville' }

function payloadForSchedule(): Payload {
  return {
    findGlobal: vi.fn(async () => ({ normalizedAt: '2026-01-01T00:00:00.000Z' })),
    find: vi.fn(async (args: { collection: string; where?: unknown }) => {
      switch (args.collection) {
        case 'food':
          return {
            docs: [
              {
                id: 'override',
                date: '2027-01-01T12:00:00.000Z',
                location,
                vendor: { id: 'vendor-1', name: 'Pierogi Truck' },
                startTime: '17:00',
              },
              {
                id: 'different-vendor',
                date: '2027-01-01T12:00:00.000Z',
                location,
                vendor: { id: 'vendor-2', name: 'Taco Truck' },
              },
              {
                id: 'unreadable-vendor',
                date: '2027-01-01T12:00:00.000Z',
                location,
                vendor: 'vendor-private',
              },
              {
                id: 'unreadable-location',
                date: '2027-01-01T12:00:00.000Z',
                location: 'location-private',
                vendor: { id: 'vendor-4', name: 'Hidden Truck' },
              },
            ],
          }
        case 'locations':
          return { docs: [location] }
        case 'recurring-food-schedules': {
          const is2027 = JSON.stringify(args.where).includes('2027')
          return {
            docs: is2027
              ? [
                  { location: location.id, vendor: 'vendor-1', day: 'friday', occurrence: 'first' },
                  {
                    location: location.id,
                    vendor: 'vendor-3',
                    day: 'friday',
                    occurrence: 'second',
                  },
                  {
                    location: 'location-private',
                    vendor: 'vendor-4',
                    day: 'friday',
                    occurrence: 'first',
                  },
                ]
              : [
                  {
                    location: location.id,
                    vendor: 'vendor-4',
                    day: 'thursday',
                    occurrence: 'fifth',
                  },
                ],
          }
        }
        case 'recurring-food-exclusions': {
          const is2027 = JSON.stringify(args.where).includes('2027')
          return {
            docs: is2027 ? [{ location: location.id, date: '2027-01-08T12:00:00.000Z' }] : [],
          }
        }
        case 'food-vendors':
          return {
            docs: [
              { id: 'vendor-1', name: 'Pierogi Truck' },
              { id: 'vendor-3', name: 'Excluded Truck' },
              { id: 'vendor-4', name: 'December Truck' },
            ],
          }
        default:
          return { docs: [] }
      }
    }),
  } as unknown as Payload
}

describe('Slack upcoming food', () => {
  it('expands across a year boundary, applies exclusions, and lets one-offs override only the same vendor', async () => {
    const entries = await findUpcomingSlackFood(
      payloadForSchedule(),
      user,
      '2026-12-30',
      '2027-01-12',
    )

    expect(entries).toEqual([
      { date: '2026-12-31', title: 'December Truck', location: 'Lawrenceville' },
      { date: '2027-01-01', title: 'Taco Truck', location: 'Lawrenceville', startTime: null },
      {
        date: '2027-01-01',
        title: 'Pierogi Truck',
        location: 'Lawrenceville',
        startTime: '17:00',
      },
    ])
  })
})
