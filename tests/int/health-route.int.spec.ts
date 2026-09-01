/** The health route reports dependency readiness without exposing internals. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { checkApplicationHealth, HealthCheckError, loggerError } = vi.hoisted(() => ({
  checkApplicationHealth: vi.fn(),
  HealthCheckError: class HealthCheckError extends Error {
    readonly stage: string

    constructor(stage: string, cause: Error) {
      super(`Health check failed during ${stage}`, { cause })
      this.stage = stage
    }
  },
  loggerError: vi.fn(),
}))
vi.mock('@/src/utils/health', () => ({
  checkApplicationHealth: () => checkApplicationHealth(),
  HealthCheckError,
}))
vi.mock('@/lib/utils/logger', () => ({
  logger: { error: loggerError },
}))

import { GET, HEAD } from '@/src/app/api/health/route'

describe('/api/health', () => {
  beforeEach(() => {
    checkApplicationHealth.mockReset()
    loggerError.mockReset()
  })

  it('returns a non-cacheable healthy GET response', async () => {
    checkApplicationHealth.mockResolvedValue(undefined)
    const response = await GET()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({ status: 'ok' })
  })

  it('logs the internal cause while returning only a generic, non-cacheable 503 body', async () => {
    const cause = new Error('mongodb://secret-host')
    checkApplicationHealth.mockRejectedValueOnce(new HealthCheckError('database-probe', cause))
    const response = await GET()
    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({ status: 'unhealthy' })
    expect(loggerError).toHaveBeenCalledWith('Application health check failed', cause, {
      stage: 'database-probe',
    })
  })

  describe('HEAD', () => {
    it('answers with the healthy status and no body', async () => {
      checkApplicationHealth.mockResolvedValue(undefined)
      const response = await HEAD()
      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(await response.text()).toBe('')
    })

    it('answers with the unhealthy status and no body', async () => {
      const cause = new Error('mongodb://secret-host')
      checkApplicationHealth.mockRejectedValueOnce(new HealthCheckError('database-probe', cause))
      const response = await HEAD()
      expect(response.status).toBe(503)
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(await response.text()).toBe('')
      expect(loggerError).toHaveBeenCalledWith('Application health check failed', cause, {
        stage: 'database-probe',
      })
    })
  })
})
