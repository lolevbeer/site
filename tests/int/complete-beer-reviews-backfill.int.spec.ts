import { expect, it, vi } from 'vitest'
import { up } from '@/src/migrations/20261005_090000_complete_beer_review_backfill'

it('completes a partial failure on retry without duplication or undoing moderation', async () => {
  const reviews = [1, 2].map((i) => ({
    url: `https://untappd.com/c/${i}`,
    text: `Review ${i}`,
    username: 'R',
    rating: 4,
  }))
  const stored: Record<string, unknown>[] = []
  const find = vi.fn(async ({ collection }) =>
    collection === 'beers'
      ? { docs: [{ id: 'b1', positiveReviews: reviews }], hasNextPage: false }
      : { docs: stored },
  )
  let failed = false
  const create = vi.fn(async ({ data }) => {
    if (stored.length === 1 && !failed) {
      failed = true
      throw new Error('interrupted')
    }
    const doc = { id: String(stored.length), ...data }
    stored.push(doc)
    return doc
  })
  const update = vi.fn()
  const args = {
    payload: { find, create, update, logger: { info: vi.fn() } },
    req: { context: {} },
  } as never
  await expect(up(args)).rejects.toThrow('interrupted')
  stored[0].approved = false
  await up(args)
  expect(stored).toHaveLength(2)
  expect(stored[0].approved).toBe(false)
  await up(args)
  expect(stored).toHaveLength(2)
  expect(update).not.toHaveBeenCalled()
})
