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
  generateWebSiteSchema,
} from '@/lib/utils/local-business-schema'
import { generateEventJsonLd, generateFoodEventJsonLd, serializeJsonLd } from '@/lib/utils/json-ld'
import { generateWebPageSchema } from '@/lib/utils/breadcrumb-schema'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { SiteJsonLd } from '@/components/seo/site-json-ld'
import { ORG_DESCRIPTION } from '@/lib/utils/seo'
import {
  LOLEV_ORG_ID,
  LOLEV_WEBSITE_ID,
  ORGANIZATION_SAME_AS,
  SOCIAL_PROFILE_URLS,
} from '@/lib/utils/schema-shared'
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
      coordinates: {
        type: 'Point',
        coordinates: [-80.1, 40.8],
      } as unknown as PayloadLocation['coordinates'],
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
      'WebSite',
      'Brewery',
      'Brewery',
    ])
    expect(graph['@graph'][0]).toMatchObject({
      '@id': LOLEV_ORG_ID,
      name: 'Lolev Beer',
      foundingDate: '2022',
      description:
        'Pittsburgh brewery sourcing specific hop lots from specialty growers worldwide, known for Ultra Hopped Ales, lagers, and oak-aged beer.',
    })
    // Superset of the footer profiles the former inline Event organizer carried.
    const { sameAs } = graph['@graph'][0] as { sameAs: string[] }
    expect(sameAs).toEqual(
      expect.arrayContaining([
        'https://untappd.com/Lolev',
        'https://www.beeradvocate.com/beer/profile/64204/',
        'https://www.facebook.com/lolevbeer/',
        'https://www.instagram.com/lolevbeer',
        'https://x.com/lolevbeer',
        ...SOCIAL_PROFILE_URLS,
      ]),
    )
  })

  it('copies phone, hours, and coordinates from the location and omits them when absent', () => {
    const graph = generateCrawlableSiteGraph([lawrenceville, zelienople])
    const [organization, , lawrencevilleNode, zelienopleNode] = graph['@graph']
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
      generateCrawlableSiteGraph([{ ...lawrenceville, name: 'Lawrenceville <script>' }]),
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
    expect(schema.location).toEqual([{ '@id': 'https://lolev.beer/#lawrenceville' }])
  })
})

describe('canonical schema identities', () => {
  const food = {
    vendorName: 'Smoke Show BBQ',
    date: '2026-10-02',
    startTime: '5:00pm',
    location: 'lawrenceville',
  } as unknown as Parameters<typeof generateFoodEventJsonLd>[0]
  const eventInput = {
    organizer: 'Karaoke Night',
    date: '2026-10-01',
    startTime: '7:00pm',
    location: 'lawrenceville',
  } as unknown as Parameters<typeof generateEventJsonLd>[0]

  /** Every @id a node defines, and every reference-only `{ '@id' }` object, in a assembled graph. */
  function collect(nodes: unknown[]) {
    const defined = new Set<string>()
    const referenced: string[] = []
    const visit = (value: unknown): void => {
      if (Array.isArray(value)) return value.forEach(visit)
      if (!value || typeof value !== 'object') return
      const record = value as Record<string, unknown>
      const id = record['@id']
      if (typeof id === 'string') {
        if (Object.keys(record).length === 1) referenced.push(id)
        else defined.add(id)
      }
      Object.values(record).forEach(visit)
    }
    nodes.forEach(visit)
    return { defined, referenced }
  }

  it('uses the sitewide /#org id for the page Organization, WebSite publisher, and WebPage', () => {
    expect(generateOrganizationSchema([lawrenceville])['@id']).toBe(LOLEV_ORG_ID)
    expect(generateWebSiteSchema().publisher).toEqual({ '@id': LOLEV_ORG_ID })
    expect(generateWebPageSchema({ name: 'X', path: '/x' }).about).toEqual({ '@id': LOLEV_ORG_ID })
  })

  it('shares one location @id between the page Brewery and the sitewide Brewery', () => {
    expect(generateLocalBusinessSchema(lawrenceville)['@id']).toBe(
      'https://lolev.beer/#lawrenceville',
    )
    expect(generateCrawlableSiteGraph([lawrenceville])['@graph'][2]['@id']).toBe(
      'https://lolev.beer/#lawrenceville',
    )
  })

  it('publishes one founding date and keeps page-specific Organization facts', () => {
    const page = generateOrganizationSchema([lawrenceville])
    const [site] = generateCrawlableSiteGraph([lawrenceville])['@graph']
    expect(page.foundingDate).toBe('2022')
    expect((site as { foundingDate: string }).foundingDate).toBe(page.foundingDate)
    expect(page.alternateName).toBe('Lolev Beer - A Brewery in Pittsburgh')
    expect(page.address?.streetAddress).toBe('5247 Butler Street')
    expect(page.telephone).toBe('(412) 336-8965')
  })

  it('points Event and FoodEvent organizers at the sitewide Organization, keeping the name', () => {
    const organizer = { '@id': LOLEV_ORG_ID, name: 'Lolev Beer' }
    expect(generateEventJsonLd(eventInput).organizer).toEqual(organizer)
    expect(generateFoodEventJsonLd(food).organizer).toEqual(organizer)
  })

  it('gives the page Organization the same description as the sitewide Organization', () => {
    const [site] = generateCrawlableSiteGraph([lawrenceville])['@graph']
    expect(generateOrganizationSchema([lawrenceville]).description).toBe(ORG_DESCRIPTION)
    expect((site as { description: string }).description).toBe(ORG_DESCRIPTION)
  })

  it('omits absent address fields on the page Organization like the sitewide node', () => {
    const bare = { id: 'loc-3', slug: 'bare', name: 'Bare', active: true } as PayloadLocation
    expect(generateOrganizationSchema([bare]).address).toBeUndefined()
    const partial = { ...bare, address: { city: 'Pittsburgh' } } as PayloadLocation
    expect(generateOrganizationSchema([partial]).address).toEqual({
      '@type': 'PostalAddress',
      addressLocality: 'Pittsburgh',
      addressCountry: 'US',
    })
  })

  it('returns sameAs arrays that callers can mutate without changing shared constants', () => {
    const before = [...SOCIAL_PROFILE_URLS]
    generateOrganizationSchema([lawrenceville]).sameAs!.push('https://example.com/x')
    generateLocalBusinessSchema(lawrenceville).sameAs!.push('https://example.com/y')
    ;(generateCrawlableSiteGraph([lawrenceville])['@graph'][0] as { sameAs: string[] }).sameAs.push(
      'https://example.com/z',
    )
    expect(SOCIAL_PROFILE_URLS).toEqual(before)
    expect(ORGANIZATION_SAME_AS).not.toContain('https://example.com/z')
  })

  it('resolves every reference in the assembled layout script plus page nodes', () => {
    const html = renderToStaticMarkup(createElement(SiteJsonLd, { locations: [lawrenceville] }))
    const payload = html.match(/<script type="application\/ld\+json">(.*)<\/script>/)?.[1] ?? ''
    const graph = JSON.parse(payload)['@graph'] as Array<Record<string, unknown>>
    expect(graph.map((node) => node['@id'])).toEqual(
      expect.arrayContaining([LOLEV_ORG_ID, LOLEV_WEBSITE_ID, 'https://lolev.beer/#lawrenceville']),
    )
    const { defined, referenced } = collect([
      ...graph,
      generateLocalBusinessSchema(lawrenceville),
      generateOrganizationSchema([lawrenceville]),
      generateWebPageSchema({ name: 'Privacy', path: '/privacy' }),
      generateEventJsonLd(eventInput),
      generateFoodEventJsonLd(food),
    ])
    expect(referenced).toEqual(expect.arrayContaining([LOLEV_ORG_ID, LOLEV_WEBSITE_ID]))
    expect(referenced.filter((id) => !defined.has(id))).toEqual([])
  })
})
