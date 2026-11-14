/**
 * Scheduled publish (#370): Beers and Menus can be queued to publish at a set
 * time, and a Vercel cron wakes the queue those jobs sit in every five minutes.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runJobs = vi.fn()
vi.mock('payload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('payload')>()),
  getPayload: vi.fn(async () => ({ jobs: { run: runJobs } })),
}))
vi.mock('@/src/payload.config', () => ({ default: {} }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('@/lib/ably/publish', () => ({ publishKioskInvalidate: vi.fn() }))
vi.mock('@/lib/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { NextRequest } from 'next/server'
import { GET } from '@/src/app/api/cron/publish-scheduled/route'
import { Beers } from '@/src/collections/Beers'
import { Menus } from '@/src/collections/Menus'

describe('collections', () => {
  it.each([
    ['beers', Beers],
    ['menus', Menus],
  ])('%s can be scheduled to publish', (_slug, collection) => {
    const versions = collection.versions as { drafts: { schedulePublish?: unknown } }
    expect(versions.drafts.schedulePublish).toBe(true)
  })

  it('menus keep their long version history', () => {
    expect((Menus.versions as { maxPerDoc?: number }).maxPerDoc).toBe(1000)
  })
})

describe('Vercel cron', () => {
  it('wakes the scheduled-publish queue every five minutes, all day', () => {
    const { crons } = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as {
      crons: { path: string; schedule: string }[]
    }
    expect(crons.find((cron) => cron.path === '/api/cron/publish-scheduled')?.schedule).toBe(
      '*/5 * * * *',
    )
  })
})

describe('GET /api/cron/publish-scheduled', () => {
  const saved = process.env.CRON_SECRET
  beforeEach(() => {
    process.env.CRON_SECRET = 'cron-test-secret'
    runJobs.mockReset()
  })
  afterEach(() => {
    if (saved === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = saved
  })

  const request = (authorization?: string) =>
    new NextRequest('http://localhost/api/cron/publish-scheduled', {
      headers: authorization ? { authorization } : {},
    })

  it.each([undefined, 'Bearer wrong'])(
    'refuses a caller without the cron secret (%s)',
    async (auth) => {
      expect((await GET(request(auth))).status).toBe(401)
      expect(runJobs).not.toHaveBeenCalled()
    },
  )

  it('refuses everyone when no secret is configured', async () => {
    delete process.env.CRON_SECRET
    expect((await GET(request('Bearer undefined'))).status).toBe(401)
  })

  // Payload's schedule drawer queues without naming a queue, so jobs land in `default`.
  it('runs the due jobs in the default queue as system code', async () => {
    runJobs.mockResolvedValue({ jobStatus: { j1: { status: 'success' } } })
    const response = await GET(request('Bearer cron-test-secret'))
    expect(runJobs).toHaveBeenCalledWith(
      expect.objectContaining({ queue: 'default', overrideAccess: true }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ success: true, ran: 1 })
  })

  it('reports a failed job with a 503 so Vercel shows the run as failed', async () => {
    runJobs.mockResolvedValue({ jobStatus: { j1: { status: 'error' } } })
    const response = await GET(request('Bearer cron-test-secret'))
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ success: false, ran: 1 })
  })
})
