/**
 * Vercel `deployment.promoted` webhook: verifies the x-vercel-signature HMAC and
 * pushes a keyless Ably invalidate so kiosk displays poll, see the new deployId,
 * and reload.
 */
import crypto from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const publishKioskInvalidate = vi.hoisted(() => vi.fn(async () => undefined))
vi.mock('@/lib/ably/publish', () => ({ publishKioskInvalidate }))

import { POST } from '@/src/app/api/vercel-deploy/route'

const SECRET = 'whsec_test'

function eventBody(type: string): string {
  return JSON.stringify({ id: 'evt_1', type, payload: {} })
}

function sign(body: string, secret: string): string {
  return crypto.createHmac('sha1', secret).update(body).digest('hex')
}

/** Pass `null` to omit the signature; pass a string to sign the same body with that secret. */
function webhook(type: string, secret?: string | null): Request {
  const body = eventBody(type)
  const headers = new Headers({ 'content-type': 'application/json' })
  if (secret !== null) {
    headers.set('x-vercel-signature', sign(body, secret ?? SECRET))
  }
  return new Request('http://localhost/api/vercel-deploy', { method: 'POST', body, headers })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('VERCEL_WEBHOOK_SECRET', SECRET)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('POST /api/vercel-deploy', () => {
  it('publishes a keyless invalidate to both kiosk channels on deployment.promoted', async () => {
    const res = await POST(webhook('deployment.promoted'))
    expect(res.status).toBe(200)
    expect(publishKioskInvalidate).toHaveBeenCalledTimes(2)
    expect(publishKioskInvalidate).toHaveBeenCalledWith({ kind: 'menu' })
    expect(publishKioskInvalidate).toHaveBeenCalledWith({ kind: 'events' })
  })

  it('rejects a signature made with the wrong secret', async () => {
    const res = await POST(webhook('deployment.promoted', 'other-secret'))
    expect(res.status).toBe(401)
    expect(publishKioskInvalidate).not.toHaveBeenCalled()
  })

  it('rejects a missing signature', async () => {
    const res = await POST(webhook('deployment.promoted', null))
    expect(res.status).toBe(401)
    expect(publishKioskInvalidate).not.toHaveBeenCalled()
  })

  it('returns 503 when the webhook secret is not configured', async () => {
    vi.stubEnv('VERCEL_WEBHOOK_SECRET', '')
    const res = await POST(webhook('deployment.promoted'))
    expect(res.status).toBe(503)
    expect(publishKioskInvalidate).not.toHaveBeenCalled()
  })

  it('acknowledges other event types without publishing', async () => {
    const res = await POST(webhook('deployment.created'))
    expect(res.status).toBe(200)
    expect(publishKioskInvalidate).not.toHaveBeenCalled()
  })
})
