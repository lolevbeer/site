// @vitest-environment node
/**
 * Payload 3 claims only payload-jobs documents with `processing: false`, but
 * Payload 4 creates jobs through `payload.db.create` without that field. The
 * jobs override in src/payload.config.ts adds a hidden `processing` checkbox
 * that defaults to false, so jobs Payload 4 creates stay runnable after an app
 * rollback to Payload 3.
 */
import type { MongooseAdapter } from '@payloadcms/db-mongodb'
import type { Payload, SanitizedConfig } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

let config: SanitizedConfig

// Loading the real config takes several seconds, past vitest's 10s hook default under load.
beforeAll(async () => {
  // readServerEnvironment() requires these; nothing in this file opens a connection.
  vi.stubEnv('DATABASE_URI', 'mongodb://127.0.0.1:1/none')
  vi.stubEnv('PAYLOAD_SECRET', 'jobs-rollback-compat')
  config = await (await import('@/src/payload.config')).default
}, 60_000)

afterAll(vi.unstubAllEnvs)

describe('payload-jobs stays runnable by Payload 3', () => {
  it('declares a hidden processing checkbox that defaults to false', () => {
    const jobs = config.collections.find(({ slug }) => slug === 'payload-jobs')
    const processing = jobs?.fields.find((field) => 'name' in field && field.name === 'processing')

    expect(processing).toMatchObject({
      type: 'checkbox',
      defaultValue: false,
      admin: { hidden: true },
    })
  })

  it('has the mongoose model write processing: false on create, with no processing_1 index', async () => {
    // db-mongodb's init() compiles every model on an unopened connection.
    const db = config.db.init({
      payload: { config, collections: {} } as unknown as Payload,
    }) as MongooseAdapter
    await db.init?.()
    const Job = db.collections['payload-jobs']

    // payload.jobs.queue() writes through Model.create, which applies schema defaults.
    expect(new Job({}).get('processing')).toBe(false)
    // 20260927_020000 drops processing_1; an indexed field would make Payload 4 rebuild it.
    expect(Job.schema.indexes()).not.toContainEqual([{ processing: 1 }, expect.anything()])
  })
})
