/** Optional real Mongo check: run only against an explicitly named disposable local database. */
import { createRequire } from 'node:module'
import { afterAll, beforeAll, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { reserveIpHashSlot } from '@/lib/public-forms/durable-limit'
import { savePublicForm } from '@/lib/public-forms/submission'

const uri = process.env.PUBLIC_FORM_TEST_DATABASE_URI
const require = createRequire(import.meta.url)
const mongoose = createRequire(require.resolve('@payloadcms/db-mongodb'))('mongoose') as {
  createConnection(uri: string): Payload['db']['connection']
}
let connection: Payload['db']['connection']
let payload: Payload
beforeAll(async () => {
  if (!uri) return
  const url = new URL(uri)
  if (url.hostname !== '127.0.0.1' || !url.pathname.endsWith('-ci'))
    throw new Error('Expected disposable local -ci database')
  connection = await mongoose.createConnection(uri).asPromise()
  const db = connection.db!
  await db.dropDatabase()
  for (const scope of ['job-applications', 'donation-requests']) {
    await db.collection(scope).insertMany([{ legacy: 'one' }, { legacy: 'two' }])
    await db.collection(scope).createIndex({ submissionKey: 1 }, { unique: true, sparse: true })
  }
  payload = {
    db: { connection },
    find: async ({
      collection,
      where,
    }: {
      collection: string
      where: { submissionKey: { equals: string } }
    }) => ({
      docs: await db
        .collection(collection)
        .find({ submissionKey: where.submissionKey.equals })
        .toArray(),
    }),
    create: async ({ collection, data }: { collection: string; data: object }) => {
      await db.collection(collection).insertOne(data)
      return data
    },
  } as unknown as Payload
})
afterAll(async () => {
  if (connection) {
    await connection.db!.dropDatabase()
    await connection.close()
  }
})

it.skipIf(!uri)(
  'enforces capacity and idempotency across independent native Mongo operations',
  async () => {
    for (const scope of ['job-applications', 'donation-requests'] as const) {
      const reservations = await Promise.all(
        Array.from({ length: 20 }, () => reserveIpHashSlot(payload, scope, 'capacity')),
      )
      expect(reservations.filter(Boolean)).toHaveLength(3)
      await connection
        .db!.collection('public-form-limits')
        .updateMany({}, { $set: { expiresAt: new Date(0) } })
      expect(await reserveIpHashSlot(payload, scope, 'capacity')).not.toBeNull()
    }
    const data = {
      job: 'j1',
      name: 'Alex',
      email: 'alex@example.test',
      phone: '123',
      message: 'Hi',
    }
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        savePublicForm(payload, 'job-applications', data, `ip-${i}`),
      ),
    )
    expect(results.filter((r) => r.status === 'created')).toHaveLength(1)
    expect(results.filter((r) => r.status === 'duplicate')).toHaveLength(11)
    expect(
      await connection
        .db!.collection('job-applications')
        .countDocuments({ submissionKey: { $exists: true } }),
    ).toBe(1)
    expect(
      await connection
        .db!.collection('job-applications')
        .countDocuments({ submissionKey: { $exists: false } }),
    ).toBe(2)
    expect(
      await connection
        .db!.collection('public-form-limits')
        .countDocuments({ _id: /^job-applications:ip-/ }),
    ).toBe(1)
  },
)
