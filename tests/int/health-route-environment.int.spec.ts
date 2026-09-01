/** Ensures invalid server configuration is returned through the public health contract. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { loggerError } = vi.hoisted(() => ({ loggerError: vi.fn() }))
vi.mock('@/lib/utils/logger', () => ({ logger: { error: loggerError } }))

const originalEnvironment = { ...process.env }

function restoreEnvironment() {
  for (const name of Object.keys(process.env)) {
    if (!(name in originalEnvironment)) delete process.env[name]
  }
  Object.assign(process.env, originalEnvironment)
}

beforeEach(() => {
  restoreEnvironment()
  process.env.PAYLOAD_SECRET = 'test-secret-that-is-not-a-placeholder'
  process.env.VERCEL_ENV = 'preview'
  loggerError.mockReset()
  vi.resetModules()
})

afterEach(restoreEnvironment)

describe('GET /api/health environment failures', () => {
  it('loads the route and returns the generic no-store 503 for invalid environment', async () => {
    process.env.DATABASE_URI = ''

    const { GET } = await import('@/src/app/api/health/route')
    const response = await GET()

    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({ status: 'unhealthy' })
    expect(loggerError).toHaveBeenCalledWith(
      'Application health check failed',
      expect.objectContaining({ name: 'ServerEnvironmentError' }),
      { stage: 'environment' },
    )
  })
})
