/**
 * Weekly regulars collapse out of the /events list so one-offs stand out.
 * A series collapses when its gaps are whole weeks and mostly one week, so a
 * holiday skip, a matching one-off override, or a first-to-fourth schedule
 * still reads as weekly; monthly, biweekly, or single occurrences stay dated.
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
    const oneOff = transformPayloadEventToBreweryEvent({
      ...base,
      id: 'abc',
    } as unknown as PayloadEvent)
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

  it('tolerates a skipped week (an excluded holiday date)', () => {
    const events = [
      ev('recurring-t-2026-11-11', '2026-11-11'),
      ev('recurring-t-2026-11-18', '2026-11-18'),
      // 11-25 excluded for Thanksgiving week.
      ev('recurring-t-2026-12-02', '2026-12-02'),
      ev('recurring-t-2026-12-09', '2026-12-09'),
    ]
    const { oneOffs, regulars } = splitRegulars(events)
    expect(oneOffs).toHaveLength(0)
    expect(regulars[0].occurrenceIds).toHaveLength(4)
  })

  it('folds a same-time one-off override back into its series', () => {
    // mergeScheduledEvents swaps a one-off in for that day's occurrence.
    const events = [
      ev('recurring-t-2026-10-14', '2026-10-14'),
      ev('override', '2026-10-21'),
      ev('recurring-t-2026-10-28', '2026-10-28'),
    ]
    const { oneOffs, regulars } = splitRegulars(events)
    expect(oneOffs).toHaveLength(0)
    expect(regulars[0].occurrenceIds).toEqual([
      'recurring-t-2026-10-14',
      'override',
      'recurring-t-2026-10-28',
    ])
  })

  it('keeps a one-off at a different time in the dated list, and the series still collapses', () => {
    const events = [
      ev('recurring-t-2026-10-14', '2026-10-14'),
      ev('special', '2026-10-21', { time: '21:00' }),
      ev('recurring-t-2026-10-28', '2026-10-28'),
      ev('recurring-t-2026-11-04', '2026-11-04'),
    ]
    const { oneOffs, regulars } = splitRegulars(events)
    expect(oneOffs.map((e) => e.id)).toEqual(['special'])
    expect(regulars).toHaveLength(1)
  })

  it('collapses a first-to-fourth schedule across a month with a fifth weekday', () => {
    // December 2026 has five Wednesdays; the 30th is skipped.
    const dates = [
      '2026-12-02',
      '2026-12-09',
      '2026-12-16',
      '2026-12-23',
      '2027-01-06',
      '2027-01-13',
    ]
    const { oneOffs, regulars } = splitRegulars(dates.map((d) => ev(`recurring-t-${d}`, d)))
    expect(oneOffs).toHaveLength(0)
    expect(regulars).toHaveLength(1)
  })

  it('leaves a first-and-third (biweekly) schedule in the dated list', () => {
    const dates = ['2026-10-07', '2026-10-21', '2026-11-04', '2026-11-18']
    const { regulars } = splitRegulars(dates.map((d) => ev(`recurring-b-${d}`, d)))
    expect(regulars).toHaveLength(0)
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
