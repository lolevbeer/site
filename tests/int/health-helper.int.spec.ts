/** Verifies the readiness helper validates configuration before initializing Payload. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { configFactory, find, getPayload } = vi.hoisted(() => ({
  configFactory: vi.fn(),
  find: vi.fn(),
  getPayload: vi.fn(),
}))

vi.mock('payload', () => ({ getPayload }))
vi.mock('@/src/payload.config', () => {
  configFactory()
  return { default: {} }
})

import { checkApplicationHealth, HealthCheckError } from '@/src/utils/health'

const originalEnvironment = { ...process.env }

function restoreEnvironment() {
  for (const name of Object.keys(process.env)) {
    if (!(name in originalEnvironment)) delete process.env[name]
  }
  Object.assign(process.env, originalEnvironment)
}

beforeEach(() => {
  restoreEnvironment()
  process.env.DATABASE_URI = 'mongodb://127.0.0.1/lolev-test'
  process.env.PAYLOAD_SECRET = 'test-secret-that-is-not-a-placeholder'
  process.env.VERCEL_ENV = 'preview'
  configFactory.mockClear()
  find.mockReset()
  getPayload.mockReset()
})

afterEach(restoreEnvironment)

describe('checkApplicationHealth', () => {
  it('validates the environment before importing config or initializing Payload', async () => {
    process.env.DATABASE_URI = ''

    await expect(checkApplicationHealth()).rejects.toMatchObject({ stage: 'environment' })
    expect(configFactory).not.toHaveBeenCalled()
    expect(getPayload).not.toHaveBeenCalled()
  })

  it('initializes Payload and executes the minimal locations readiness query', async () => {
    getPayload.mockResolvedValue({ find })
    find.mockResolvedValue({ docs: [] })

    await expect(checkApplicationHealth()).resolves.toBeUndefined()
    expect(getPayload).toHaveBeenCalledWith({ config: {} })
    expect(find).toHaveBeenCalledWith({
      collection: 'locations',
      limit: 1,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
  })

  it.each([
    ['payload initialization', () => getPayload.mockRejectedValue(new Error('payload failure')), 'payload-init'],
    [
      'database probe',
      () => {
        getPayload.mockResolvedValue({ find })
        find.mockRejectedValue(new Error('mongodb://secret-host'))
      },
      'database-probe',
    ],
  ])('maps %s failures to a safe stage', async (_name, fail, stage) => {
    fail()

    await expect(checkApplicationHealth()).rejects.toMatchObject({ stage })
    await expect(checkApplicationHealth()).rejects.toBeInstanceOf(HealthCheckError)
  })
})
