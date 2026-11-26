/** The Hall of Fame stays out of search while it has no reviews. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/utils/payload-api', () => ({ getHallOfFameReviews: vi.fn() }))
vi.mock('@/lib/seo/resolve-metadata', () => ({
  buildPageMetadata: vi.fn(async () => ({ title: 'Hall of Fame' })),
}))

import { generateMetadata } from '@/src/app/(frontend)/hall-of-fame/page'
import { getHallOfFameReviews } from '@/lib/utils/payload-api'

const reviews = getHallOfFameReviews as ReturnType<typeof vi.fn>

describe('Hall of Fame metadata', () => {
  beforeEach(() => reviews.mockClear())

  it('is noindex (links still followed) while no review is ticked', async () => {
    reviews.mockResolvedValue([])
    expect((await generateMetadata()).robots).toEqual({ index: false, follow: true })
  })

  it('is indexable once a review is on it', async () => {
    reviews.mockResolvedValue([{ id: 'r1' }])
    expect((await generateMetadata()).robots).toBeUndefined()
  })

  it('stays indexable when the reviews cannot be read', async () => {
    reviews.mockRejectedValueOnce(new Error('db down'))
    expect((await generateMetadata()).robots).toBeUndefined()
  })
})
