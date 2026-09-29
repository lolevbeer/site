/**
 * LocalBusiness JSON-LD: valid schema.org type, Eastern hours (not UTC),
 * geo from Payload point fields, unique url per taproom.
 */
import { describe, expect, it } from 'vitest'
import {
  generateCrawlableSiteGraph,
  generateLocalBusinessSchema,
  generateLocalBusinessSchemas,
  generateOrganizationSchema,
} from '@/lib/utils/local-business-schema'
import { serializeJsonLd } from '@/lib/utils/json-ld'
import type { PayloadLocation } from '@/lib/types/location'

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
} as PayloadLocation

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

  it('keeps holiday closures off the standing weekly spec', () => {
    const schema = generateLocalBusinessSchema(lawrenceville, [
      {
        day: 'monday',
        open: null,
        close: null,
        closed: true,
        holidayName: 'Labor Day',
        date: '2026-09-07',
      },
    ])
    const monday = schema.openingHoursSpecification.find((row) =>
      (Array.isArray(row.dayOfWeek) ? row.dayOfWeek : [row.dayOfWeek]).includes('Monday'),
    )
    expect(monday?.opens).toBe('16:00')
    expect(schema.specialOpeningHoursSpecification?.[0]).toMatchObject({
      validFrom: '2026-09-07',
      validThrough: '2026-09-07',
    })
    expect(schema.specialOpeningHoursSpecification?.[0].opens).toBeUndefined()
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
      // Raw DB reads can return GeoJSON, which Payload's generated type doesn't declare.
      coordinates: { type: 'Point', coordinates: [-80.1, 40.8] } as unknown as PayloadLocation['coordinates'],
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

  it('sets Butler County areaServed and description for Zelienople', () => {
    const schema = generateLocalBusinessSchema({
      ...lawrenceville,
      id: 'loc-2',
      slug: 'zelienople',
      name: 'Zelienople',
      address: {
        street: '111 South Main Street',
        city: 'Zelienople',
        state: 'PA',
        zip: '16063',
      },
    })
    expect(schema.areaServed).toEqual([
      { '@type': 'AdministrativeArea', name: 'Butler County' },
      { '@type': 'City', name: 'Zelienople' },
      { '@type': 'Place', name: 'Cranberry Township' },
      { '@type': 'City', name: 'Harmony' },
      { '@type': 'City', name: 'Mars' },
    ])
    expect(schema.description).toContain('Butler County')
    expect(schema.description).not.toMatch(/\u2014|—/)
  })

  it('sets Allegheny County areaServed for Lawrenceville', () => {
    const schema = generateLocalBusinessSchema(lawrenceville)
    expect(schema.areaServed).toEqual([
      { '@type': 'AdministrativeArea', name: 'Allegheny County' },
      { '@type': 'City', name: 'Pittsburgh' },
      { '@type': 'Place', name: 'Lawrenceville' },
    ])
    expect(schema.description).toContain('Pittsburgh Lawrenceville')
    expect(schema.description).not.toMatch(/\u2014|—/)
  })
})

describe('generateCrawlableSiteGraph', () => {
  const zelienople = {
    id: 'loc-2',
    slug: 'zelienople',
    name: 'Zelienople',
    active: true,
    address: {
      street: '111 South Main Street',
      city: 'Zelienople',
      state: 'PA',
      zip: '16063',
    },
  } as PayloadLocation

  it('publishes one Organization and one Brewery per taproom', () => {
    const graph = generateCrawlableSiteGraph([lawrenceville, zelienople])
    expect(graph['@graph'].map((node) => node['@type'])).toEqual([
      'Organization',
      'Brewery',
      'Brewery',
    ])
    expect(graph['@graph'][0]).toMatchObject({
      '@id': 'https://lolev.beer/#org',
      name: 'Lolev Beer',
      foundingDate: '2022-12',
      description:
        'Pittsburgh brewery sourcing specific hop lots from specialty growers worldwide, known for Ultra Hopped Ales, lagers, and oak-aged beer.',
      sameAs: [
        'https://untappd.com/Lolev',
        'https://www.beeradvocate.com/beer/profile/64204/',
        'https://www.facebook.com/lolevbeer/',
        'https://www.instagram.com/lolevbeer',
        'https://x.com/lolevbeer',
      ],
    })
  })

  it('copies phone, hours, and coordinates from the location and omits them when absent', () => {
    const graph = generateCrawlableSiteGraph([lawrenceville, zelienople])
    const [organization, lawrencevilleNode, zelienopleNode] = graph['@graph']
    expect(organization['@type']).toBe('Organization')
    expect(lawrencevilleNode).toMatchObject({
      '@id': 'https://lolev.beer/#lawrenceville',
      parentOrganization: { '@id': 'https://lolev.beer/#org' },
      telephone: '(412) 336-8965',
      address: {
        streetAddress: '5247 Butler Street',
        addressLocality: 'Pittsburgh',
        addressRegion: 'PA',
        postalCode: '15201',
        addressCountry: 'US',
      },
      geo: { latitude: 40.465372, longitude: -79.960098 },
    })
    const monday = lawrencevilleNode.openingHoursSpecification?.find((row) =>
      (Array.isArray(row.dayOfWeek) ? row.dayOfWeek : [row.dayOfWeek]).includes('Monday'),
    )
    expect(monday?.opens).toBe('16:00')
    expect(zelienopleNode.telephone).toBeUndefined()
    expect(zelienopleNode.openingHoursSpecification).toBeUndefined()
    expect(zelienopleNode.geo).toBeUndefined()
    expect(zelienopleNode.address?.streetAddress).toBe('111 South Main Street')
  })

  it('escapes < in the serialized script payload', () => {
    const html = serializeJsonLd(
      generateCrawlableSiteGraph([
        { ...lawrenceville, name: 'Lawrenceville <script>' },
      ]),
    )
    expect(html).toContain('\\u003c')
    expect(html).not.toContain('<script>')
  })
})

describe('generateOrganizationSchema', () => {
  it('includes NAP and location @id refs when locations are passed', () => {
    const schema = generateOrganizationSchema([lawrenceville])
    expect(schema.telephone).toBe('(412) 336-8965')
    expect(schema.sameAs).toContain('https://x.com/lolevbeer')
    expect(schema.sameAs).not.toContain('https://twitter.com/lolevbeer')
    expect(schema.location).toEqual([{ '@id': 'https://lolev.beer#lawrenceville' }])
  })
})
