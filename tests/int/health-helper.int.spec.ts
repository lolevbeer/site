/** Verifies the readiness helper validates configuration before initializing Payload. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { command, configFactory, getPayload } = vi.hoisted(() => ({
  command: vi.fn(),
  configFactory: vi.fn(),
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
  command.mockReset()
  configFactory.mockClear()
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

  it('initializes Payload and pings its MongoDB handle with a cancellable timeout', async () => {
    getPayload.mockResolvedValue({
      db: { collections: { locations: { collection: { conn: { db: { command } } } } } },
    })
    command.mockResolvedValue({ ok: 1 })

    await expect(checkApplicationHealth()).resolves.toBeUndefined()
    expect(getPayload).toHaveBeenCalledWith({ config: {} })
    expect(command).toHaveBeenCalledWith({ ping: 1 }, { timeoutMS: 5000 })
  })

  it('maps an unavailable native MongoDB handle to the database-probe stage', async () => {
    getPayload.mockResolvedValue({ db: { collections: {} } })

    await expect(checkApplicationHealth()).rejects.toMatchObject({ stage: 'database-probe' })
  })

  it.each([
    ['payload initialization', () => getPayload.mockRejectedValue(new Error('payload failure')), 'payload-init'],
    [
      'database probe',
      () => {
        getPayload.mockResolvedValue({
          db: { collections: { locations: { collection: { conn: { db: { command } } } } } },
        })
        command.mockRejectedValue(new Error('mongodb://secret-host'))
      },
      'database-probe',
    ],
  ])('maps %s failures to a safe stage', async (_name, fail, stage) => {
    fail()

    await expect(checkApplicationHealth()).rejects.toMatchObject({ stage })
    await expect(checkApplicationHealth()).rejects.toBeInstanceOf(HealthCheckError)
  })
})
