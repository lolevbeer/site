import { describe, expect, it } from 'vitest'
import { normalizeUrl } from '@/lib/utils/url-utils'
import {
  getBeerImageUrl,
  getLocationImageUrl,
  getMediaUrl,
} from '@/lib/utils/media-utils'

const blobHost = 'https://abc123.public.blob.vercel-storage.com'
const sizedMedia = {
  url: `${blobHost}/hades.png`,
  sizes: {
    thumbnail: { url: `${blobHost}/hades-150x150.webp` },
    card: { url: `${blobHost}/hades-500x500.webp` },
    detail: { url: `${blobHost}/hades-1200x1200.webp` },
  },
}

const originMedia = {
  url: 'https://lolev.beer/api/media/file/hades.png',
  sizes: {
    thumbnail: { url: 'https://lolev.beer/api/media/file/hades-150x150.webp' },
    card: { url: 'http://localhost:3000/api/media/file/hades-500x500.webp' },
  },
}

describe('normalizeUrl', () => {
  it('leaves relative paths unchanged', () => {
    expect(normalizeUrl('/api/media/file/hades.png')).toBe('/api/media/file/hades.png')
  })

  it('preserves Vercel Blob CDN absolute URLs', () => {
    expect(normalizeUrl(`${blobHost}/hades.png`)).toBe(`${blobHost}/hades.png`)
    expect(normalizeUrl(`${blobHost}/path/hades-500x500.webp?x=1`)).toBe(
      `${blobHost}/path/hades-500x500.webp?x=1`,
    )
  })

  it('strips app/localhost hosts to pathname for env-agnostic paths', () => {
    expect(normalizeUrl('https://lolev.beer/api/media/file/hades.png')).toBe(
      '/api/media/file/hades.png',
    )
    expect(normalizeUrl('http://localhost:3002/api/media/file/hades.png')).toBe(
      '/api/media/file/hades.png',
    )
  })

  it('returns the original string when URL parsing fails', () => {
    expect(normalizeUrl('not a url')).toBe('not a url')
  })
})

describe('getMediaUrl', () => {
  it('returns undefined for null, undefined, and unpopulated IDs', () => {
    expect(getMediaUrl(null)).toBeUndefined()
    expect(getMediaUrl(undefined)).toBeUndefined()
    expect(getMediaUrl('media-id-only')).toBeUndefined()
  })

  it('returns the requested size when present, preserving Blob hosts', () => {
    expect(getMediaUrl(sizedMedia, 'thumbnail')).toBe(`${blobHost}/hades-150x150.webp`)
    expect(getMediaUrl(sizedMedia, 'card')).toBe(`${blobHost}/hades-500x500.webp`)
    expect(getMediaUrl(sizedMedia, 'detail')).toBe(`${blobHost}/hades-1200x1200.webp`)
  })

  it('falls back to the original URL when a size is missing', () => {
    expect(getMediaUrl({ url: `${blobHost}/only-original.png` }, 'card')).toBe(
      `${blobHost}/only-original.png`,
    )
  })

  it('strips non-blob hosts on sized and original URLs', () => {
    expect(getMediaUrl(originMedia, 'thumbnail')).toBe('/api/media/file/hades-150x150.webp')
    expect(getMediaUrl(originMedia, 'card')).toBe('/api/media/file/hades-500x500.webp')
    expect(getMediaUrl(originMedia)).toBe('/api/media/file/hades.png')
  })

  it('returns undefined for non-image media shapes without a url', () => {
    expect(getMediaUrl({ alt: 'x' })).toBeUndefined()
    expect(getMediaUrl(42)).toBeUndefined()
  })
})

describe('getBeerImageUrl', () => {
  it('returns null for empty image values', () => {
    expect(getBeerImageUrl(null)).toBeNull()
    expect(getBeerImageUrl(false)).toBeNull()
  })

  it('normalizes string URLs and preserves Blob hosts', () => {
    expect(getBeerImageUrl(`${blobHost}/can.png`)).toBe(`${blobHost}/can.png`)
    expect(getBeerImageUrl('https://lolev.beer/api/media/file/can.png')).toBe(
      '/api/media/file/can.png',
    )
  })

  it('maps boolean true to the local PNG path', () => {
    expect(getBeerImageUrl(true, 'hades')).toBe('/images/beer/hades.png')
    expect(getBeerImageUrl(true)).toBeNull()
  })

  it('uses Payload sizes when provided on a Media object', () => {
    expect(getBeerImageUrl(sizedMedia, 'hades', 'thumbnail')).toBe(
      `${blobHost}/hades-150x150.webp`,
    )
    expect(getBeerImageUrl(sizedMedia, 'hades', 'card')).toBe(`${blobHost}/hades-500x500.webp`)
    expect(getBeerImageUrl(sizedMedia, undefined, 'detail')).toBe(
      `${blobHost}/hades-1200x1200.webp`,
    )
  })
})

describe('getLocationImageUrl', () => {
  it('returns null for empty values and normalizes Media URLs', () => {
    expect(getLocationImageUrl(null)).toBeNull()
    expect(getLocationImageUrl(sizedMedia)).toBe(`${blobHost}/hades.png`)
    expect(getLocationImageUrl(sizedMedia, 'card')).toBe(`${blobHost}/hades-500x500.webp`)
  })

  it('normalizes legacy string URLs', () => {
    expect(getLocationImageUrl(`${blobHost}/loc.png`)).toBe(`${blobHost}/loc.png`)
    expect(getLocationImageUrl('https://lolev.beer/api/media/file/loc.png')).toBe(
      '/api/media/file/loc.png',
    )
  })
})
