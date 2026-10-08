/**
 * Event JSON-LD must include a real Place address when a location lookup is
 * provided, and always emit url / description / image (with OG fallback).
 */
import { describe, expect, it } from 'vitest'
import { createLocationLookup, generateEventJsonLd } from '@/lib/utils/json-ld'
import { EventStatus, EventType } from '@/lib/types/event'
import type { PayloadLocation } from '@/lib/types/location'

type EventInput = Parameters<typeof generateEventJsonLd>[0]
/** Fixtures set only the fields these tests read. */
const event = (fields: Partial<EventInput>) => fields as EventInput

const location: PayloadLocation = {
  id: 'loc-1',
  slug: 'lawrenceville',
  name: 'Lawrenceville',
  address: {
    street: '5247 Butler Street',
    city: 'Pittsburgh',
    state: 'PA',
    zip: '15201',
  },
  coordinates: [-79.96, 40.46],
} as PayloadLocation

describe('generateEventJsonLd', () => {
  it('leaves an empty address when no lookup is passed (the homepage bug)', () => {
    const schema = generateEventJsonLd(
      event({
        organizer: "Drew's Clues Trivia",
        date: '2026-09-09',
        startTime: '4:00pm',
        location: 'lawrenceville',
      }),
    )
    expect(schema.location.address.streetAddress).toBe('')
  })

  it('fills Place from the lookup and qualifies the name with the taproom', () => {
    const lookup = createLocationLookup([location])
    const schema = generateEventJsonLd(
      event({
        organizer: "Drew's Clues Trivia",
        date: '2026-09-09',
        startTime: '4:00pm',
        location: { slug: 'lawrenceville' } as PayloadLocation,
      }),
      lookup,
    )
    expect(schema.location.address.streetAddress).toBe('5247 Butler Street')
    expect(schema.location.address.addressLocality).toBe('Pittsburgh')
    expect(schema.name).toContain('Lawrenceville')
    expect(schema.url).toBe('https://lolev.beer/events')
  })

  it('always emits description, url, and OG image fallback', () => {
    const schema = generateEventJsonLd(
      event({
        organizer: 'Karaoke Night',
        date: '2026-10-01',
        startTime: '7:00pm',
        endTime: '10:00pm',
        location: 'lawrenceville',
      }),
    )
    expect(schema.description).toBe('Karaoke Night')
    expect(schema.url).toBe('https://lolev.beer/events')
    expect(schema.image).toBe('https://lolev.beer/images/beer/og-image.jpg')
    expect(schema.endDate).toBeTruthy()
  })

  it('prefers CMS description, site url, and absolute event image', () => {
    const schema = generateEventJsonLd(
      event({
        title: 'Beer Release',
        description: 'Hazy IPA drop party',
        date: '2026-10-02',
        time: '5:00pm',
        endTime: '8:00pm',
        status: EventStatus.SCHEDULED,
        location: 'lawrenceville',
        vendor: 'Lolev',
        type: EventType.SPECIAL_EVENT,
        site: 'https://lolev.beer/events',
        image: '/api/media/file/release.jpg',
      }),
    )
    expect(schema.description).toBe('Hazy IPA drop party')
    expect(schema.url).toBe('https://lolev.beer/events')
    expect(schema.image).toBe('https://lolev.beer/api/media/file/release.jpg')
    expect(schema.endDate).toBeTruthy()
  })
})

it.each([
  ['2026-07-01', '7pm', '2026-07-01T23:00:00.000Z'],
  ['2026-01-01', '7pm', '2026-01-02T00:00:00.000Z'],
  ['2026-07-01', '2000-01-01T23:00:00.000Z', '2026-07-01T22:00:00.000Z'],
  ['2026-03-08', '3am', '2026-03-08T07:00:00.000Z'],
])('uses the Pittsburgh wall time for %s / %s', (date, startTime, expected) => {
  expect(
    generateEventJsonLd(event({ organizer: 'Trivia', date, startTime, location: 'lawrenceville' }))
      .startDate,
  ).toBe(expected)
})
it('rolls overnight events to the following local day and keeps date-only schedules date-only', () => {
  const schema = generateEventJsonLd(
    event({
      organizer: 'Trivia',
      date: '2026-07-01',
      startTime: '11pm',
      endTime: '1am',
      location: 'lawrenceville',
    }),
  )
  expect(schema.startDate).toBe('2026-07-02T03:00:00.000Z')
  expect(schema.endDate).toBe('2026-07-02T05:00:00.000Z')
  expect(
    generateEventJsonLd(
      event({ organizer: 'Trivia', date: '2026-07-01', location: 'lawrenceville' }),
    ).startDate,
  ).toBe('2026-07-01')
})
