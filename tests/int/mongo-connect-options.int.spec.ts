/**
 * Mongo driver options: on Vercel a stalled query fails after 20s instead of
 * holding a function until Vercel kills it (the scheduled-publish cron timed
 * out at 60s on Nov 23, 2026). Migrations and local scripts stay unbounded.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MONGO_SOCKET_TIMEOUT_MS, mongoConnectOptions } from '@/src/utils/mongo-connect-options'

describe('mongoConnectOptions', () => {
  it('bounds socket reads on Vercel, well inside the shortest function limit', () => {
    const options = mongoConnectOptions({ onVercel: true, migration: false })
    expect(options.socketTimeoutMS).toBe(MONGO_SOCKET_TIMEOUT_MS)
    expect(MONGO_SOCKET_TIMEOUT_MS).toBeLessThan(60_000)
    expect(MONGO_SOCKET_TIMEOUT_MS).toBeGreaterThan(options.serverSelectionTimeoutMS)
  })

  it('leaves migrations and local runs without a socket timeout', () => {
    expect(mongoConnectOptions({ onVercel: true, migration: true })).not.toHaveProperty(
      'socketTimeoutMS',
    )
    expect(mongoConnectOptions({ onVercel: false, migration: false })).not.toHaveProperty(
      'socketTimeoutMS',
    )
  })

  it('keeps the pool caps and connect bounds everywhere', () => {
    for (const onVercel of [true, false]) {
      expect(mongoConnectOptions({ onVercel, migration: false })).toMatchObject({
        maxPoolSize: 10,
        maxIdleTimeMS: 10_000,
        connectTimeoutMS: 5_000,
        serverSelectionTimeoutMS: 5_000,
      })
    }
  })

  it('is what the Payload config passes to the adapter', () => {
    const source = readFileSync(join(process.cwd(), 'src/payload.config.ts'), 'utf8')
    expect(source).toMatch(/connectOptions: mongoConnectOptions\(\{/)
  })
})
