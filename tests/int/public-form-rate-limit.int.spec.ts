import { expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { reserveIpHashSlot } from '@/lib/public-forms/durable-limit'
import { savePublicForm } from '@/lib/public-forms/submission'

function store() {
  const slots = new Map<string, { expiresAt: Date; token: string }>()
  const records = new Map<string, unknown>()
  const updateOne = vi.fn(async (filter, update) => {
    const current = slots.get(filter._id)
    if (current && current.expiresAt > filter.expiresAt.$lte) throw { code: 11000 }
    slots.set(filter._id, update.$set)
  })
  const deleteOne = vi.fn(async (filter) => {
    if (slots.get(filter._id)?.token === filter.token) slots.delete(filter._id)
  })
  const create = vi.fn(async ({ data }) => {
    if (records.has(data.submissionKey)) throw { code: 11000 }
    const doc = { id: data.submissionKey, ...data }
    records.set(data.submissionKey, doc)
    return doc
  })
  const find = vi.fn(async ({ where }) => ({
    docs: records.has(where.submissionKey.equals) ? [records.get(where.submissionKey.equals)] : [],
  }))
  return {
    payload: {
      db: { connection: { db: { collection: () => ({ updateOne, deleteOne }) } } },
      find,
      create,
    } as unknown as Payload,
    updateOne,
    slots,
    create,
  }
}

it.each(['donation-requests', 'job-applications'] as const)(
  'atomically reserves three slots across concurrent %s callers and expires capacity',
  async (scope) => {
    const { payload, slots } = store()
    const results = await Promise.all(
      Array.from({ length: 8 }, () => reserveIpHashSlot(payload, scope, 'hash')),
    )
    expect(results.filter(Boolean)).toHaveLength(3)
    for (const slot of slots.values()) slot.expiresAt = new Date(0)
    expect(await reserveIpHashSlot(payload, scope, 'hash')).not.toBeNull()
  },
)

it('fails closed on storage failure and releases only its own reservation', async () => {
  const { payload, updateOne, slots } = store()
  updateOne.mockRejectedValueOnce(new Error('DB unavailable'))
  await expect(reserveIpHashSlot(payload, 'job-applications', 'hash')).rejects.toThrow(
    'DB unavailable',
  )
  const release = await reserveIpHashSlot(payload, 'job-applications', 'hash')
  slots.get('job-applications:hash:0')!.expiresAt = new Date(0)
  const next = await reserveIpHashSlot(payload, 'job-applications', 'hash')
  await release!()
  expect(slots.size).toBe(1)
  await next!()
  expect(slots.size).toBe(0)
})

it('concurrent identical submissions create one record; changed content remains distinct', async () => {
  const { payload, create, slots } = store()
  const data = { job: 'j1', name: 'Alex', email: 'alex@example.test', phone: '123', message: 'Hi' }
  const results = await Promise.all([
    savePublicForm(payload, 'job-applications', data, 'ip1'),
    savePublicForm(payload, 'job-applications', data, 'ip2'),
  ])
  expect(results.map((r) => r.status).sort()).toEqual(['created', 'duplicate'])
  expect(slots.size).toBe(1)
  expect(
    (await savePublicForm(payload, 'job-applications', { ...data, message: 'Different' }, 'ip1'))
      .status,
  ).toBe('created')
  expect(create).toHaveBeenCalledTimes(3)
})

it('releases capacity after persistence failure and does not acknowledge an unsaved request', async () => {
  const { payload, create, slots } = store()
  create.mockRejectedValueOnce(new Error('write failed'))
  await expect(
    savePublicForm(
      payload,
      'job-applications',
      { job: 'j1', name: 'Alex', email: 'a@example.test', phone: '123', message: 'Hi' },
      'ip',
    ),
  ).rejects.toThrow('write failed')
  expect(slots.size).toBe(0)
})
