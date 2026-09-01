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
