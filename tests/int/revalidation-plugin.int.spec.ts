/**
 * Collection cache maps used by hooks and by bulk writers that skip
 * per-document revalidation then call revalidateForCollection once.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const revalidateTag = vi.fn()
const revalidatePath = vi.fn()
vi.mock('next/cache', () => ({
  revalidateTag: (...args: unknown[]) => revalidateTag(...args),
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}))

import { revalidateForCollection } from '@/src/plugins/revalidation-plugin'

describe('revalidateForCollection', () => {
  beforeEach(() => {
    revalidateTag.mockReset()
    revalidatePath.mockReset()
  })

  it('invalidates homepage and location event pages for recurring-food writes', () => {
    revalidateForCollection('recurring-food-schedules')

    expect(revalidateTag.mock.calls.map((call) => call[0]).sort()).toEqual(['food', 'recurring-food'])
    expect(revalidatePath.mock.calls).toEqual(
      expect.arrayContaining([
        ['/'],
        ['/food'],
        ['/e', 'layout'],
      ]),
    )
  })

  it('keeps beer bulk invalidation on the beers list paths', () => {
    revalidateForCollection('beers')

    expect(revalidateTag).toHaveBeenCalledWith('beers')
    expect(revalidatePath.mock.calls.map((call) => call[0]).sort()).toEqual(['/', '/beer'])
  })
})
