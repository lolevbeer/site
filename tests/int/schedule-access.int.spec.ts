import { describe, expect, it } from 'vitest'
import type { Access, PayloadRequest } from 'payload'
import type { User } from '@/src/payload-types'
import {
  readEvents,
  readRecurringEvents,
  readFood,
  readRecurringFood,
} from '@/src/access/schedules'

const read = (access: Access, roles: User['roles'], locations: User['locations'] = ['own']) =>
  access({ slug: 'events', req: { user: { id: 'staff', roles, locations } } as PayloadRequest })

describe('schedule location permissions', () => {
  for (const access of [readEvents, readRecurringEvents, readFood, readRecurringFood]) {
    it(`${access.name} scopes both bartender roles and denies unassigned staff`, async () => {
      for (const role of ['bartender', 'lead-bartender'] as const) {
        const expected = { location: { in: ['own'] } }
        expect(await read(access, [role])).toEqual(
          access === readRecurringFood
            ? { and: [expected, { active: { equals: true } }] }
            : expected,
        )
        expect(await read(access, [role], [])).toBe(false)
        expect(await read(access, ['admin', role], [])).toBe(true)
      }
    })
  }

  it('preserves manager precedence and public visibility', async () => {
    expect(await read(readEvents, ['event-manager', 'bartender'], [])).toBe(true)
    expect(await read(readRecurringEvents, ['event-manager'], [])).toBe(true)
    expect(await read(readFood, ['food-manager', 'bartender'], [])).toBe(true)
    expect(await read(readRecurringFood, ['food-manager'], [])).toBe(true)
    const args = { slug: 'events' as const, req: { user: null } as PayloadRequest }
    expect(await readEvents(args)).toEqual({ visibility: { equals: 'public' } })
    expect(await readRecurringEvents(args)).toEqual({
      active: { equals: true },
      visibility: { equals: 'public' },
    })
    expect(await readFood(args)).toBe(true)
    expect(await readRecurringFood(args)).toEqual({ active: { equals: true } })
  })
})
