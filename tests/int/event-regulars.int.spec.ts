/**
 * Weekly regulars collapse out of the /events list so one-offs stand out.
 * Only recurring occurrences exactly a week apart collapse; a monthly or
 * single occurrence stays in the dated list rather than being mislabeled.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@/src/payload.config', () => ({ default: {} }))

import { regularLabel, splitRegulars } from '@/lib/utils/event-regulars'
import { transformPayloadEventToBreweryEvent } from '@/lib/utils/payload-api'
import { EventStatus, EventType, type BreweryEvent } from '@/lib/types/event'
import type { Event as PayloadEvent } from '@/src/payload-types'

function ev(id: string, date: string, overrides: Partial<BreweryEvent> = {}): BreweryEvent {
  return {
    id,
    title: 'Trivia',
    date,
    time: '19:00',
    vendor: 'Trivia',
    type: id.startsWith('recurring-') ? EventType.RECURRING : EventType.SPECIAL_EVENT,
    status: EventStatus.SCHEDULED,
    location: 'lawrenceville',
    ...overrides,
  }
}

describe('transformPayloadEventToBreweryEvent', () => {
  it('marks expanded recurring occurrences as RECURRING', () => {
    const base = { organizer: 'Trivia', date: '2026-10-14T12:00:00.000Z', location: 'x' }
    const recurring = transformPayloadEventToBreweryEvent({
      ...base,
      id: 'recurring-def1-2026-10-14',
    } as unknown as PayloadEvent)
    const oneOff = transformPayloadEventToBreweryEvent({ ...base, id: 'abc' } as unknown as PayloadEvent)
    expect(recurring.type).toBe(EventType.RECURRING)
    expect(oneOff.type).toBe(EventType.SPECIAL_EVENT)
  })
})

describe('splitRegulars', () => {
  it('collapses weekly occurrences into one regular and keeps one-offs', () => {
    const events = [
      ev('recurring-t-2026-10-14', '2026-10-14'),
      ev('release', '2026-10-15', { title: 'Mosaic can release' }),
      ev('recurring-t-2026-10-21', '2026-10-21'),
      ev('recurring-t-2026-10-28', '2026-10-28'),
    ]
    const { oneOffs, regulars } = splitRegulars(events)
    expect(oneOffs.map((e) => e.id)).toEqual(['release'])
    expect(regulars).toHaveLength(1)
    expect(regulars[0].next.id).toBe('recurring-t-2026-10-14')
    expect(regulars[0].occurrenceIds).toEqual([
      'recurring-t-2026-10-14',
      'recurring-t-2026-10-21',
      'recurring-t-2026-10-28',
    ])
  })

  it('keeps separate regulars per location', () => {
    const events = [
      ev('recurring-a-2026-10-14', '2026-10-14'),
      ev('recurring-a-2026-10-21', '2026-10-21'),
      ev('recurring-b-2026-10-14', '2026-10-14', { location: 'zelienople' }),
      ev('recurring-b-2026-10-21', '2026-10-21', { location: 'zelienople' }),
    ]
    expect(splitRegulars(events).regulars).toHaveLength(2)
  })

  it('leaves monthly and lone occurrences in the dated list', () => {
    const events = [
      ev('recurring-m-2026-10-07', '2026-10-07'),
      ev('recurring-m-2026-11-04', '2026-11-04'),
      ev('recurring-x-2026-10-09', '2026-10-09', { title: 'Bingo' }),
    ]
    const { oneOffs, regulars } = splitRegulars(events)
    expect(regulars).toHaveLength(0)
    expect(oneOffs).toHaveLength(3)
  })

  it('never collapses non-recurring events even when weekly', () => {
    const events = [ev('a', '2026-10-14'), ev('b', '2026-10-21')]
    expect(splitRegulars(events).regulars).toHaveLength(0)
  })
})

describe('regularLabel', () => {
  it('reads weekday, time, and title', () => {
    expect(regularLabel(ev('recurring-t-2026-10-14', '2026-10-14'))).toBe('Wednesdays 7pm · Trivia')
  })

  it('omits a missing or TBD time', () => {
    expect(regularLabel(ev('recurring-t-2026-10-14', '2026-10-14', { time: 'TBD' }))).toBe(
      'Wednesdays · Trivia',
    )
  })
})
