/** Verifies that release-smoke seeding cannot initialize or mutate unsafe database targets. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isDisposableDatabase } from '@/scripts/e2e-database-guard'

const { configInitialized, getPayload } = vi.hoisted(() => ({
  configInitialized: vi.fn(),
  getPayload: vi.fn(),
}))

vi.mock('payload', () => ({ getPayload }))
vi.mock('@/src/payload.config', () => {
  configInitialized()
  return { default: {} }
})

const e2eEnvironment = [
  'DATABASE_URI',
  'E2E_ADMIN_EMAIL',
  'E2E_ADMIN_PASSWORD',
  'E2E_DISPOSABLE_DATABASE',
  'PAYLOAD_DROP_DATABASE',
] as const

async function importSeed(environment: Partial<Record<(typeof e2eEnvironment)[number], string>>) {
  for (const name of e2eEnvironment) vi.stubEnv(name, environment[name])
  await import('@/scripts/seed-e2e')
}

describe('isDisposableDatabase', () => {
  it('permits only local databases or explicitly marked remote e2e databases', () => {
    expect(isDisposableDatabase('mongodb://127.0.0.1:27017/test', undefined)).toBe(true)
    expect(isDisposableDatabase('mongodb://localhost:27017/test', undefined)).toBe(true)
    expect(isDisposableDatabase('mongodb+srv://cluster.example/release-ci', '1')).toBe(true)
    expect(isDisposableDatabase('mongodb+srv://cluster.example/test', '1')).toBe(false)
    expect(isDisposableDatabase('mongodb+srv://cluster.example/release-ci', undefined)).toBe(false)
    expect(isDisposableDatabase('not-a-url', '1')).toBe(false)
  })
})

describe('seed-e2e execution guard', () => {
  beforeEach(() => {
    vi.resetModules()
    configInitialized.mockReset()
    getPayload.mockReset()
  })

  afterEach(vi.unstubAllEnvs)

  it('rejects an unsafe URI before config initialization or Payload access', async () => {
    await expect(
      importSeed({
        DATABASE_URI: 'mongodb+srv://cluster.example/production',
        E2E_ADMIN_EMAIL: 'release-smoke@example.test',
        E2E_ADMIN_PASSWORD: 'password',
      }),
    ).rejects.toThrow('disposable database target')

    expect(configInitialized).not.toHaveBeenCalled()
    expect(getPayload).not.toHaveBeenCalled()
  })

  it('rejects a destructive drop flag before config initialization or Payload access', async () => {
    await expect(
      importSeed({
        DATABASE_URI: 'mongodb://127.0.0.1:27017/release-e2e',
        E2E_ADMIN_EMAIL: 'release-smoke@example.test',
        E2E_ADMIN_PASSWORD: 'password',
        PAYLOAD_DROP_DATABASE: 'true',
      }),
    ).rejects.toThrow('PAYLOAD_DROP_DATABASE')

    expect(configInitialized).not.toHaveBeenCalled()
    expect(getPayload).not.toHaveBeenCalled()
  })

  it.each(['locations', 'styles', 'beers', 'menus', 'jobs', 'users'])(
    'rejects duplicate %s fixtures before any writes',
    async (duplicateCollection) => {
      const create = vi.fn().mockResolvedValue({ id: 'created' })
      const update = vi.fn().mockResolvedValue({ id: 'updated' })
      const find = vi.fn(async ({ collection }) => ({
        docs: collection === duplicateCollection ? [{ id: 'one' }, { id: 'two' }] : [],
      }))
      getPayload.mockResolvedValue({ find, create, update })
      await expect(
        importSeed({
          DATABASE_URI: 'mongodb://127.0.0.1:27017/release-e2e',
          E2E_ADMIN_EMAIL: 'release-smoke@example.test',
          E2E_ADMIN_PASSWORD: 'password',
        }),
      ).rejects.toThrow('duplicate release-smoke')
      expect(create).not.toHaveBeenCalled()
      expect(update).not.toHaveBeenCalled()
    },
  )

  it('creates public fixtures and repairs the same records on rerun', async () => {
    const records = new Map<string, Record<string, unknown>>()
    const find = vi.fn(async ({ collection }) => ({
      docs: records.has(collection) ? [records.get(collection)] : [],
    }))
    const create = vi.fn(async ({ collection, data }) => {
      const record = { id: `${collection}-fixture`, ...data }
      records.set(collection, record)
      return record
    })
    const update = vi.fn(async ({ collection, id, data }) => {
      expect(id).toBe(records.get(collection)?.id)
      const record = { ...records.get(collection), ...data }
      records.set(collection, record)
      return record
    })
    getPayload.mockResolvedValue({ find, create, update })
    const environment = {
      DATABASE_URI: 'mongodb://127.0.0.1:27017/release-e2e',
      E2E_ADMIN_EMAIL: 'release-smoke@example.test',
      E2E_ADMIN_PASSWORD: 'password',
    }
    await importSeed(environment)
    // Location pages render the location name as the smoke-tested heading.
    expect(records.get('locations')?.name).toMatch(/^Lolev /)
    expect(records.get('locations')).toMatchObject({
      active: true,
      slug: 'lolev-release-smoke',
      draftMenu: 'menus-fixture',
    })
    expect(records.get('beers')).toMatchObject({
      slug: 'release-smoke-beer',
      style: 'styles-fixture',
      _status: 'published',
      hideFromSite: false,
      glass: 'pint',
      abv: 5,
      draftPrice: 7,
    })
    expect(records.get('beers')).not.toHaveProperty('untappd')
    expect(records.get('beers')).not.toHaveProperty('recipe')
    expect(records.get('menus')).toMatchObject({
      url: 'release-smoke-location-draft',
      type: 'draft',
      location: 'locations-fixture',
      _status: 'published',
      items: [{ product: { relationTo: 'beers', value: 'beers-fixture' } }],
    })
    expect(records.get('jobs')).toMatchObject({ active: true, location: 'locations-fixture' })
    expect(records.get('users')).toMatchObject({ roles: ['admin'] })
    expect(records.get('faqs')).toMatchObject({ active: true })

    expect(find.mock.calls.map(([options]) => options)).toEqual([
      expect.objectContaining({ where: { question: { equals: 'Production readiness fixture' } } }),
      expect.objectContaining({ where: { name: { equals: 'Lolev Release Smoke' } } }),
      expect.objectContaining({ where: { name: { equals: 'Release Smoke Style' } } }),
      expect.objectContaining({ where: { slug: { equals: 'release-smoke-beer' } } }),
      expect.objectContaining({ where: { url: { equals: 'release-smoke-location-draft' } } }),
      expect.objectContaining({ where: { slug: { equals: 'release-smoke-job' } } }),
      expect.objectContaining({ where: { email: { equals: environment.E2E_ADMIN_EMAIL } } }),
    ])
    records.set('locations', { ...records.get('locations'), active: false, draftMenu: null })
    records.set('menus', { ...records.get('menus'), _status: 'draft', items: [] })
    records.set('beers', { ...records.get('beers'), _status: 'draft', hideFromSite: true })
    const { runSeed } = await import('@/scripts/seed-e2e')
    await runSeed()
    expect(create).toHaveBeenCalledTimes(7)
    expect(records.size).toBe(7)
    expect(records.get('locations')).toMatchObject({ active: true, draftMenu: 'menus-fixture' })
    expect(records.get('menus')).toMatchObject({
      _status: 'published',
      items: [{ product: { relationTo: 'beers', value: 'beers-fixture' } }],
    })
    expect(records.get('beers')).toMatchObject({ _status: 'published', hideFromSite: false })
    for (const [options] of [...create.mock.calls, ...update.mock.calls]) {
      expect(options).toMatchObject({ overrideAccess: true, context: { skipRevalidate: true } })
    }
    for (const [options] of find.mock.calls) {
      expect(options).toMatchObject({ overrideAccess: true, limit: 2 })
    }
  })

  it('rejects duplicate fixture records before making a mutation', async () => {
    const find = vi.fn().mockResolvedValueOnce({ docs: [{ id: 'fixture-1' }, { id: 'fixture-2' }] })
    getPayload.mockResolvedValue({ find })

    await expect(
      importSeed({
        DATABASE_URI: 'mongodb://127.0.0.1:27017/release-e2e',
        E2E_ADMIN_EMAIL: 'release-smoke@example.test',
        E2E_ADMIN_PASSWORD: 'password',
      }),
    ).rejects.toThrow('duplicate release-smoke FAQ fixtures')

    expect(find).toHaveBeenCalledWith(expect.objectContaining({ collection: 'faqs', limit: 2 }))
    expect(getPayload).toHaveBeenCalledTimes(1)
  })
})
