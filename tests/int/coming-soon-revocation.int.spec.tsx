/** Warm a populated cache, revoke publication, then exercise the real hook and public renderer. */
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import type { Config } from 'payload'
import { UpcomingBeers } from '@/components/home/upcoming-beers'

const state = vi.hoisted(() => ({
  published: true,
  values: new Map<string, { tags: string[]; value: unknown }>(),
}))
vi.mock('next/cache', () => ({
  unstable_cache:
    (fn: () => Promise<unknown>, keys: string[], options: { tags: string[] }) => async () => {
      const key = keys.join(':')
      if (!state.values.has(key)) state.values.set(key, { tags: options.tags, value: await fn() })
      return state.values.get(key)!.value
    },
  revalidateTag: (tag: string, profile: unknown) => {
    // SWR deliberately retains the first stale response; hard expiry must remove it.
    if (typeof profile === 'object')
      for (const [key, entry] of state.values)
        if (entry.tags.includes(tag)) state.values.delete(key)
  },
  revalidatePath: vi.fn(),
}))
vi.mock('payload', () => ({
  getPayload: async () => ({
    findGlobal: async () => ({
      beers: [
        { beer: state.published ? { id: 'b1', name: 'Soon Beer', slug: 'soon-beer' } : 'b1' },
      ],
    }),
  }),
}))
vi.mock('@/src/payload.config', () => ({ default: {} }))
vi.mock('@/lib/ably/publish', () => ({ publishKioskInvalidate: vi.fn() }))
vi.mock('@/components/ui/scroll-reveal', () => ({
  ScrollReveal: ({ children }: { children: React.ReactNode }) => children,
}))
import { getComingSoonBeers } from '@/lib/utils/payload-api'
import { revalidationPlugin } from '@/src/plugins/revalidation-plugin'

it('removes previously cached beer names and links on unpublish and deletion', async () => {
  const config = await revalidationPlugin({
    collections: [{ slug: 'beers', fields: [] }],
  } as unknown as Config)
  const hooks = config.collections![0].hooks!
  const hookArgs = { doc: { id: 'b1', _status: 'draft' }, req: { query: {} } }
  for (const hook of [hooks.afterChange![0], hooks.afterDelete![0]]) {
    state.values.clear()
    state.published = true
    expect(
      renderToStaticMarkup(<UpcomingBeers comingSoonBeers={await getComingSoonBeers()} />),
    ).toContain('Soon Beer')
    state.published = false
    expect(
      renderToStaticMarkup(<UpcomingBeers comingSoonBeers={await getComingSoonBeers()} />),
    ).toContain('Soon Beer')
    await (hook as unknown as (args: typeof hookArgs) => Promise<unknown>)(hookArgs)
    expect(
      renderToStaticMarkup(<UpcomingBeers comingSoonBeers={await getComingSoonBeers()} />),
    ).toBe('')
  }
})
