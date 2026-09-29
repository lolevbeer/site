// @vitest-environment node
// (node env: satori's PNG step rejects jsdom's cross-realm Uint8Array)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'

vi.mock('@/lib/utils/payload-api', () => ({
  getBeerBySlug: vi.fn(async (slug: string) =>
    slug === 'lupula'
      ? {
          name: 'Lupula',
          slug: 'lupula',
          abv: 6.5,
          style: { name: 'IPA' },
          image: true,
          hideFromSite: false,
        }
      : slug === 'hidden'
        ? { name: 'Hidden', slug: 'hidden', hideFromSite: true }
        : null,
  ),
  getAllLocations: vi.fn(async () => [
    {
      name: 'Lawrenceville',
      slug: 'lawrenceville',
      address: { city: 'Pittsburgh', state: 'PA', zip: '15201' },
    },
  ]),
}))

import { GET as beerCard } from '@/src/app/og/beer/[slug]/route'
import { GET as locationCard } from '@/src/app/og/location/[slug]/route'
import { renderOgCard } from '@/lib/og/card'

const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) })
const req = new Request('https://lolev.beer/og')

describe('OG card routes', () => {
  const realFetch = globalThis.fetch
  const fetchMock = vi.fn()
  beforeEach(async () => {
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } })
      .png()
      .toBuffer()
    fetchMock.mockReset()
    // next/og loads its wasm renderer through fetch (a data: URL); only http(s) photo fetches are stubbed.
    fetchMock.mockImplementation(async (input: URL | string) =>
      /^https?:/.test(String(input)) ? new Response(new Uint8Array(png)) : realFetch(input),
    )
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())
  const photoCalls = () =>
    fetchMock.mock.calls.map(([input]) => String(input)).filter((url) => /^https?:/.test(url))

  it('renders a PNG for a visible beer', async () => {
    const res = await beerCard(req, ctx('lupula'))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('cache-control')).not.toContain('immutable')
    // ImageResponse renders lazily, so read the body to prove it really produced a PNG.
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect([...bytes.slice(1, 4)]).toEqual([0x50, 0x4e, 0x47])
  })

  it('404s for missing and hidden beers', async () => {
    expect((await beerCard(req, ctx('nope'))).status).toBe(404)
    expect((await beerCard(req, ctx('hidden'))).status).toBe(404)
  })

  it('renders a PNG for a known taproom and 404s for an unknown one', async () => {
    const ok = await locationCard(req, ctx('lawrenceville'))
    expect(ok.status).toBe(200)
    expect((await ok.arrayBuffer()).byteLength).toBeGreaterThan(1000)
    expect((await locationCard(req, ctx('nowhere'))).status).toBe(404)
  })

  it('fetches beer photos over HTTP from the site origin (public/ is not in the Vercel bundle)', async () => {
    await (await beerCard(req, ctx('lupula'))).arrayBuffer()
    expect(photoCalls()).toEqual(['https://lolev.beer/images/beer/lupula.png'])
  })

  it('accepts Vercel Blob media but never fetches other hosts', async () => {
    await (
      await renderOgCard({
        title: 'A',
        imageUrl: 'https://abc.public.blob.vercel-storage.com/a.png',
      })
    ).arrayBuffer()
    expect(photoCalls()).toHaveLength(1)

    fetchMock.mockClear()
    for (const imageUrl of [
      'https://evil.example/a.png',
      '//evil.example/a.png',
      'http://169.254.169.254/latest',
    ]) {
      const res = await renderOgCard({ title: 'A', imageUrl })
      expect(res.status).toBe(200) // still renders, text only
      await res.arrayBuffer()
    }
    expect(photoCalls()).toEqual([])
  })
})
