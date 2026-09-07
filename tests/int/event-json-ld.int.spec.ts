/**
 * Event JSON-LD must include a real Place address when a location lookup is
 * provided, and names must distinguish the two taprooms.
 */
import { describe, expect, it } from 'vitest'
import { createLocationLookup, generateEventJsonLd } from '@/lib/utils/json-ld'

const location = {
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
} as any

describe('generateEventJsonLd', () => {
  it('leaves an empty address when no lookup is passed (the homepage bug)', () => {
    const schema = generateEventJsonLd({
      organizer: "Drew's Clues Trivia",
      date: '2026-09-09',
      startTime: '4:00pm',
      location: 'lawrenceville',
    } as any)
    expect(schema.location.address.streetAddress).toBe('')
  })

  it('fills Place from the lookup and qualifies the name with the taproom', () => {
    const lookup = createLocationLookup([location])
    const schema = generateEventJsonLd(
      {
        organizer: "Drew's Clues Trivia",
        date: '2026-09-09',
        startTime: '4:00pm',
        location: { slug: 'lawrenceville' },
      } as any,
      lookup,
    )
    expect(schema.location.address.streetAddress).toBe('5247 Butler Street')
    expect(schema.location.address.addressLocality).toBe('Pittsburgh')
    expect(schema.name).toContain('Lawrenceville')
    expect(schema.url).toBe('https://lolev.beer/events')
  })
})
