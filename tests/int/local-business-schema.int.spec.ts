/**
 * LocalBusiness JSON-LD: valid schema.org type, Eastern hours (not UTC),
 * geo from Payload point fields, unique url per taproom.
 */
import { describe, expect, it } from 'vitest'
import {
  generateLocalBusinessSchema,
  generateLocalBusinessSchemas,
  generateOrganizationSchema,
} from '@/lib/utils/local-business-schema'

/** 4pm–10pm America/New_York on 2000-01-01 (EST, UTC−5) stored the way Payload time fields arrive. */
const lawrenceville = {
  id: 'loc-1',
  slug: 'lawrenceville',
  name: 'Lawrenceville',
  active: true,
  timezone: 'America/New_York',
  address: {
    street: '5247 Butler Street',
    city: 'Pittsburgh',
    state: 'PA',
    zip: '15201',
  },
  basicInfo: { phone: '(412) 336-8965', email: 'info@lolev.beer' },
  monday: { open: '2000-01-01T21:00:00.000Z', close: '2000-01-02T03:00:00.000Z' },
  tuesday: { open: '2000-01-01T21:00:00.000Z', close: '2000-01-02T03:00:00.000Z' },
  coordinates: [-79.960098, 40.465372],
} as any

describe('generateLocalBusinessSchema', () => {
  it('uses schema.org Brewery, not BreweryOrDistillery', () => {
    const schema = generateLocalBusinessSchema(lawrenceville)
    expect(schema['@type']).toBe('Brewery')
  })

  it('emits opening hours in America/New_York, not UTC', () => {
    const schema = generateLocalBusinessSchema(lawrenceville)
    const monday = schema.openingHoursSpecification.find((row) =>
      (Array.isArray(row.dayOfWeek) ? row.dayOfWeek : [row.dayOfWeek]).includes('Monday'),
    )
    expect(monday?.opens).toBe('16:00')
    expect(monday?.closes).toBe('22:00')
  })

  it('points url at the location landing page and includes geo', () => {
    const schema = generateLocalBusinessSchema(lawrenceville)
    expect(schema.url).toBe('https://lolev.beer/lawrenceville')
    expect(schema.geo).toEqual({
      '@type': 'GeoCoordinates',
      latitude: 40.465372,
      longitude: -79.960098,
    })
  })

  it('reads GeoJSON-shaped Payload points', () => {
    const schema = generateLocalBusinessSchema({
      ...lawrenceville,
      coordinates: { type: 'Point', coordinates: [-80.1, 40.8] },
    })
    expect(schema.geo).toEqual({
      '@type': 'GeoCoordinates',
      latitude: 40.8,
      longitude: -80.1,
    })
  })

  it('gives each taproom its own url', () => {
    const schemas = generateLocalBusinessSchemas([
      lawrenceville,
      { ...lawrenceville, slug: 'zelienople', name: 'Zelienople', id: 'loc-2' },
    ])
    expect(schemas.map((s) => s.url)).toEqual([
      'https://lolev.beer/lawrenceville',
      'https://lolev.beer/zelienople',
    ])
  })
})

describe('generateOrganizationSchema', () => {
  it('includes NAP and location @id refs when locations are passed', () => {
    const schema = generateOrganizationSchema([lawrenceville]) as Record<string, unknown>
    expect(schema.telephone).toBe('(412) 336-8965')
    expect(schema.sameAs).toContain('https://x.com/lolevbeer')
    expect(schema.sameAs).not.toContain('https://twitter.com/lolevbeer')
    expect(schema.location).toEqual([{ '@id': 'https://lolev.beer#lawrenceville' }])
  })
})
