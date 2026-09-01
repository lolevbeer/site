/**
 * Homepage ISR fallback is one hour; on-demand path invalidation stays in the plugin.
 */
import { describe, expect, it } from 'vitest'
import { revalidate } from '@/src/app/(frontend)/page'
import { MENU_DATA_CACHE_REVALIDATE_SECONDS } from '@/lib/utils/payload-api'

describe('homepage ISR fallback', () => {
  it('exports revalidate = 3600', () => {
    expect(revalidate).toBe(3600)
  })
})

describe('menu data-cache fallback', () => {
  it('is one hour so tags remain the freshness path', () => {
    expect(MENU_DATA_CACHE_REVALIDATE_SECONDS).toBe(3600)
  })
})
