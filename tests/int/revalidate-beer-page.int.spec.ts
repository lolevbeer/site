/**
 * Approving or rejecting a beer-reviews document must invalidate the ISR
 * beer page (`/beer/[slug]`), not just the beers list.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'

const revalidatePath = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}))
vi.mock('@/lib/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { revalidateBeerPageForReview } from '@/src/utils/revalidate-beer-page'

describe('revalidateBeerPageForReview', () => {
  beforeEach(() => {
    revalidatePath.mockReset()
  })

  it('uses a populated beer slug without another query', async () => {
    const findByID = vi.fn()
    await revalidateBeerPageForReview(
      { findByID } as unknown as Payload,
      { id: 'beer-1', slug: 'akko' },
    )

    expect(findByID).not.toHaveBeenCalled()
    expect(revalidatePath).toHaveBeenCalledWith('/beer/akko')
  })

  it('looks up the slug when the review only stores a beer id', async () => {
    const findByID = vi.fn(async () => ({ slug: 'akko' }))
    await revalidateBeerPageForReview({ findByID } as unknown as Payload, 'beer-1')

    expect(findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'beers', id: 'beer-1' }),
    )
    expect(revalidatePath).toHaveBeenCalledWith('/beer/akko')
  })

  it('does not throw when the related beer is missing', async () => {
    const findByID = vi.fn(async () => {
      throw new Error('not found')
    })
    await expect(
      revalidateBeerPageForReview({ findByID } as unknown as Payload, 'missing'),
    ).resolves.toBeUndefined()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
