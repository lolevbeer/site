/** Ensures invalid server configuration is returned through the public health contract. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { loggerError } = vi.hoisted(() => ({ loggerError: vi.fn() }))
vi.mock('@/lib/utils/logger', () => ({ logger: { error: loggerError } }))

beforeEach(() => {
  vi.stubEnv('PAYLOAD_SECRET', 'test-secret-that-is-not-a-placeholder')
  vi.stubEnv('VERCEL_ENV', 'preview')
  loggerError.mockReset()
  vi.resetModules()
})

afterEach(vi.unstubAllEnvs)

describe('/api/health environment failures', () => {
  it('loads the route and returns the generic no-store 503 for invalid environment', async () => {
    vi.stubEnv('DATABASE_URI', '')

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

  it('answers HEAD with the same generic no-store 503 and no body', async () => {
    vi.stubEnv('DATABASE_URI', '')

    const { HEAD } = await import('@/src/app/api/health/route')
    const response = await HEAD()

    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.text()).toBe('')
    expect(loggerError).toHaveBeenCalledWith(
      'Application health check failed',
      expect.objectContaining({ name: 'ServerEnvironmentError' }),
      { stage: 'environment' },
    )
  })
})
