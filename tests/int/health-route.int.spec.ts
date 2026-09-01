/** The health route reports dependency readiness without exposing internals. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { checkApplicationHealth, loggerError } = vi.hoisted(() => ({
  checkApplicationHealth: vi.fn(),
  loggerError: vi.fn(),
}))
vi.mock('@/src/utils/health', () => ({
  checkApplicationHealth: () => checkApplicationHealth(),
}))
vi.mock('@/lib/utils/logger', () => ({
  logger: { error: loggerError },
}))

import { GET } from '@/src/app/api/health/route'

describe('GET /api/health', () => {
  beforeEach(() => {
    checkApplicationHealth.mockReset()
    loggerError.mockReset()
  })

  it('returns a non-cacheable healthy response', async () => {
    checkApplicationHealth.mockResolvedValue(undefined)
    const response = await GET()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({ status: 'ok' })
  })

  it('returns only a generic, non-cacheable 503 body on failure', async () => {
    checkApplicationHealth.mockRejectedValueOnce(new Error('mongodb://secret-host'))
    const response = await GET()
    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({ status: 'unhealthy' })
    expect(loggerError).toHaveBeenCalledWith('Application health check failed')
  })
})
