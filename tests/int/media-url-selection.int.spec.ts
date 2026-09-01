/**
 * Payload derivative selection. Missing generated sizes fall back to original.
 */
import { describe, expect, it } from 'vitest'
import { getBeerImageUrl, getLocationImageUrl, getMediaUrl } from '@/lib/utils/media-utils'

const media = {
  url: '/api/media/file/orig.png',
  sizes: {
    thumbnail: { url: '/api/media/file/orig-thumb.webp' },
    card: { url: '/api/media/file/orig-card.webp' },
    detail: { url: '/api/media/file/orig-detail.webp' },
  },
}

describe('getMediaUrl', () => {
  it('returns each requested derivative when present', () => {
    expect(getMediaUrl(media, 'thumbnail')).toBe('/api/media/file/orig-thumb.webp')
    expect(getMediaUrl(media, 'card')).toBe('/api/media/file/orig-card.webp')
    expect(getMediaUrl(media, 'detail')).toBe('/api/media/file/orig-detail.webp')
  })

  it('falls back to the original when the derivative is missing', () => {
    expect(getMediaUrl({ url: '/api/media/file/orig.png', sizes: {} }, 'thumbnail')).toBe(
      '/api/media/file/orig.png',
    )
  })

  it('returns undefined for string media references', () => {
    expect(getMediaUrl('abc123', 'thumbnail')).toBeUndefined()
  })

  it('returns undefined for non-image values', () => {
    expect(getMediaUrl(null, 'card')).toBeUndefined()
    expect(getMediaUrl({ mimeType: 'video/webm' }, 'card')).toBeUndefined()
  })
})

describe('getBeerImageUrl', () => {
  it('uses the thumbnail derivative for 64/96px roles', () => {
    expect(getBeerImageUrl(media, 'hades', 'thumbnail')).toBe('/api/media/file/orig-thumb.webp')
  })

  it('falls back to the original when the thumbnail is missing', () => {
    expect(getBeerImageUrl({ url: '/api/media/file/orig.png' }, 'hades', 'thumbnail')).toBe(
      '/api/media/file/orig.png',
    )
  })
})

describe('getLocationImageUrl', () => {
  it('keeps landscape location photos on the original, not the square card crop', () => {
    expect(getLocationImageUrl(media)).toBe('/api/media/file/orig.png')
  })
})
