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

import { revalidateForCollection, revalidationPlugin } from '@/src/plugins/revalidation-plugin'
import type { Config } from 'payload'

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

    expect(revalidateTag.mock.calls.map((call) => call[0]).sort()).toEqual(['beers', 'menus'])
    expect(revalidatePath.mock.calls.map((call) => call[0]).sort()).toEqual([
      '/',
      '/beer',
      '/beer/[variant]',
    ])
    expect(revalidatePath).toHaveBeenCalledWith('/beer/[variant]', 'page')
  })
})

describe('site-seo global hook', () => {
  it('revalidates the whole route tree, since every page reads it for metadata', async () => {
    revalidateTag.mockReset()
    revalidatePath.mockReset()
    const config = await revalidationPlugin({
      globals: [{ slug: 'site-seo', fields: [] }],
    } as unknown as Config)
    const hook = config.globals![0].hooks!.afterChange![0] as (args: {
      doc: object
    }) => Promise<unknown>

    await hook({ doc: {} })

    expect(revalidateTag).toHaveBeenCalledWith('site-seo', 'max')
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })
})
