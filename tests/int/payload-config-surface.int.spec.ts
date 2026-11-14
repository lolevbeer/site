/**
 * What the built Payload config exposes: GraphQL stays off (#367, nothing calls
 * it), and admin list search covers more than each list's title field (#369).
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { Field, SanitizedConfig } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

let config: SanitizedConfig

beforeAll(async () => {
  // Building the config only validates these; nothing connects to the database.
  vi.stubEnv('DATABASE_URI', process.env.DATABASE_URI || 'mongodb://127.0.0.1:27017/config-test')
  vi.stubEnv('PAYLOAD_SECRET', process.env.PAYLOAD_SECRET || 'config-test-secret')
  config = await (await import('@/src/payload.config')).default
}, 60_000)

describe('GraphQL (#367)', () => {
  it('is disabled and has no route files', () => {
    expect(config.graphQL.disable).toBe(true)
    for (const route of ['graphql', 'graphql-playground']) {
      expect(existsSync(join(process.cwd(), 'src/app/(payload)/api', route, 'route.ts'))).toBe(
        false,
      )
    }
  })
})

/** Every named field in a collection, through rows, groups-without-names, tabs and collapsibles. */
function namedFields(fields: Field[]): Extract<Field, { name: string }>[] {
  return fields.flatMap((field) => {
    if ('name' in field) return [field]
    if (field.type === 'tabs') return field.tabs.flatMap((tab) => namedFields(tab.fields))
    if ('fields' in field) return namedFields(field.fields)
    return []
  })
}

describe('admin list search (#369)', () => {
  const expected: Record<string, string[]> = {
    'event-inquiries': ['name', 'email', 'phone', 'companyName'],
    'donation-requests': ['organizationName', 'contactName', 'email', 'phone', 'eventName'],
    'job-applications': ['name', 'email', 'phone'],
    events: ['organizer', 'summary'],
    'recurring-events': ['organizer', 'summary'],
    distributors: ['name', 'city', 'address'],
  }

  it.each(Object.entries(expected))('%s searches %j', (slug, fields) => {
    const collection = config.collections.find((c) => c.slug === slug)!
    expect(collection.admin.listSearchableFields).toEqual(fields)
  })

  // Payload refuses a query on a field the viewer cannot read, so a searchable
  // field with its own read rule would break search for every other role.
  it.each(Object.keys(expected))(
    '%s searches only fields without a field-level read rule',
    (slug) => {
      const collection = config.collections.find((c) => c.slug === slug)!
      const byName = new Map(namedFields(collection.fields).map((f) => [f.name, f]))
      for (const name of collection.admin.listSearchableFields ?? []) {
        expect(byName.get(name), `${slug}.${name} exists`).toBeDefined()
        const field = byName.get(name)!
        const readRule = 'access' in field ? field.access?.read : undefined
        expect(readRule, `${slug}.${name} read rule`).toBeUndefined()
      }
    },
  )
})
