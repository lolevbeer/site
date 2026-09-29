/**
 * buildPageMetadata: CMS SEO overrides merged with code fallbacks.
 * Covers the pieces the layout's shallow `openGraph` merge would otherwise drop or contradict.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const siteSeo = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
vi.mock('@/lib/utils/site-seo', () => ({ getSiteSeo: vi.fn(async () => siteSeo.current) }))

import { buildPageMetadata } from '@/lib/seo/resolve-metadata'

const base = {
  fallbackTitle: 'Lupula',
  fallbackDescription: 'A beer.',
  canonicalPath: '/beer/lupula',
}

describe('buildPageMetadata', () => {
  beforeEach(() => {
    siteSeo.current = {}
  })

  it('restates og:url so the layout merge does not drop it', async () => {
    const meta = await buildPageMetadata(base)
    expect(meta.openGraph).toMatchObject({
      url: '/beer/lupula',
      siteName: 'Lolev Beer',
      locale: 'en_US',
    })
  })

  it('uses the CMS canonical override for og:url too', async () => {
    const meta = await buildPageMetadata({ ...base, seo: { canonicalPath: '/beer' } })
    expect(meta.alternates?.canonical).toBe('/beer')
    expect(meta.openGraph).toMatchObject({ url: '/beer' })
  })

  it('builds og:title from the CMS title template, not a hard-coded suffix', async () => {
    expect((await buildPageMetadata(base)).openGraph?.title).toBe('Lupula | Lolev Beer')
    siteSeo.current = { titleTemplate: '%s · Lolev' }
    expect((await buildPageMetadata(base)).openGraph?.title).toBe('Lupula · Lolev')
  })

  it('leaves the title bare for the layout template, or absolute for Home', async () => {
    expect((await buildPageMetadata(base)).title).toBe('Lupula')
    const home = await buildPageMetadata({ ...base, absoluteTitle: true })
    expect(home.title).toEqual({ absolute: 'Lupula' })
    expect(home.openGraph?.title).toBe('Lupula')
  })

  it('noindex keeps links followable', async () => {
    const meta = await buildPageMetadata({ ...base, seo: { noIndex: true } })
    expect(meta.robots).toEqual({ index: false, follow: true })
  })

  it('declares an upload’s real OG image size, and none when unknown', async () => {
    const upload = (extra: object) => ({
      url: 'https://x.public.blob.vercel-storage.com/a.png',
      alt: 'A',
      ...extra,
    })
    const sized = await buildPageMetadata({
      ...base,
      seo: { ogImage: upload({ width: 800, height: 800 }) } as never,
    })
    expect(sized.openGraph?.images).toEqual([expect.objectContaining({ width: 800, height: 800 })])

    const unsized = await buildPageMetadata({ ...base, seo: { ogImage: upload({}) } as never })
    const [image] = unsized.openGraph?.images as Array<Record<string, unknown>>
    expect(image).not.toHaveProperty('width')
  })
})
