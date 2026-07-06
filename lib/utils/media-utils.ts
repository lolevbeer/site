/**
 * Media utility functions
 * Consolidated image/media URL extraction for Payload CMS
 */

import type { CSSProperties } from 'react'
import { normalizeUrl } from './url-utils'

/**
 * Container MIME type for generated can-label sweep videos. Single source of
 * truth shared by the admin recorder (Blob type) and the Media collection's
 * upload allowlist — they must match or uploads 400 after a full recording.
 */
export const LABEL_VIDEO_MIME = 'video/webm'

/**
 * Layout of the generated can-rotation sprite sheet (stored in the beer's
 * `labelVideo` field — a PNG, not a video, despite the legacy field name).
 * The admin recorder tiles `frames` render frames left-to-right, top-to-bottom
 * into a `cols`×`rows` grid; menu displays animate it with a CSS steps() sweep
 * (see `canSpriteAnimation`) instead of a <video>.
 *
 * Why a sprite sheet: the menus run on Samsung Frame TVs whose browser decodes
 * only one <video> at a time and does not composite WebM alpha — a grid of
 * video cans showed one can plus black rectangles. A PNG sheet is a background
 * image (no video decoder, real transparency), so every can animates.
 *
 * Smoothness is frames / loop-seconds: 48 frames over 7.2s ≈ 6.7fps, enough for
 * a gentle sway. Raising `frames` further is the lever for more smoothness, but
 * every can's sheet is a decoded bitmap held in TV RAM at once (decoded size is
 * pixel-count, not file-size), so frames trade off against frame resolution and
 * total memory — a menu of ~12 cans at 256×320×48 is ~190MB decoded. If cans
 * start blanking on the TV that's RAM pressure: cut `frames` or the frame size.
 *
 * ponytail: a grid (not one long row) keeps the sheet well under 4096px so
 * older Tizen GPUs can upload the texture. Invariants (`cols*rows === frames`,
 * and `loopMs % rows === 0` so the two-axis animation can't drift) are asserted
 * in can-sprite.int.spec.ts.
 */
export const CAN_SPRITE = {
  frames: 48,
  cols: 8,
  rows: 6,
  frameWidth: 256,
  frameHeight: 320,
  loopMs: 7200,
} as const

/**
 * Inline-style values that animate a CAN_SPRITE sheet as a gentle back-and-
 * forth can rotation. Kept pure (no JSX) so the geometry is unit-testable; the
 * display spreads the result onto a div and pairs it with the `can-sprite-x`/
 * `can-sprite-y` keyframes in globals.css.
 *
 * The steps() sweep walks a background-position sized to `cols`/`rows` copies
 * of the element. The end positions overshoot 100% (`100*n/(n-1)`) so each
 * discrete step lands exactly on a frame boundary — the classic sprite-sheet
 * off-by-one correction. The x sweep completes one row per `loopMs/rows`, at
 * which point the slower y sweep advances exactly one row.
 */
export function canSpriteAnimation(url: string): CSSProperties {
  const { cols, rows, frameWidth, frameHeight, loopMs } = CAN_SPRITE
  return {
    backgroundImage: `url(${url})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${cols * 100}% ${rows * 100}%`,
    aspectRatio: `${frameWidth} / ${frameHeight}`,
    animation: `can-sprite-x ${loopMs / rows}ms steps(${cols}) infinite, can-sprite-y ${loopMs}ms steps(${rows}) infinite`,
    ['--can-sprite-x-end' as string]: `${(100 * cols) / (cols - 1)}%`,
    ['--can-sprite-y-end' as string]: `${(100 * rows) / (rows - 1)}%`,
  } as CSSProperties
}

/**
 * Type for Payload Media objects
 * Matches the essential fields from Payload's Media collection
 */
type MediaSize = 'thumbnail' | 'card' | 'detail'

interface MediaSizeObject {
  url?: string | null
}

interface MediaObject {
  url?: string | null
  thumbnailURL?: string | null
  sizes?: Partial<Record<MediaSize, MediaSizeObject>>
}

/**
 * Get URL from a Payload Media relation field
 * Handles the various states a media field can be in:
 * - null/undefined: returns undefined
 * - string (just an ID, not populated): returns undefined
 * - Media object with url: returns normalized URL
 *
 * URLs are normalized to be relative for environment-agnostic usage
 *
 * @param media - The media field value (string ID, Media object, null, or undefined)
 * @returns The normalized URL string, or undefined if not available
 */
export function getMediaUrl(media: unknown, size?: MediaSize): string | undefined {
  if (!media) return undefined

  // Just an ID reference, not a populated Media object
  if (typeof media === 'string') return undefined

  // Check if it's a Media object with a url property
  if (typeof media === 'object' && media !== null && 'url' in media) {
    const obj = media as MediaObject

    // Try the requested size first
    if (size) {
      const sizedUrl = obj.sizes?.[size]?.url
      if (sizedUrl) return normalizeUrl(sizedUrl)
    }

    const url = obj.url
    if (!url) return undefined
    return normalizeUrl(url)
  }

  return undefined
}

/**
 * Get image URL for a beer, handling various image field formats
 *
 * Supports:
 * - undefined/null/false: returns null (no image)
 * - string: returns normalized URL
 * - true (boolean): returns path to local PNG based on slug/variant
 * - Media object: extracts and normalizes URL
 *
 * @param image - The beer's image field value
 * @param slugOrVariant - Optional slug or variant for local image path fallback
 * @returns The image URL string, or null if not available
 */
export function getBeerImageUrl(image: unknown, slugOrVariant?: string): string | null {
  if (!image) return null

  // Already a URL string (from payload-adapter conversion or direct URL)
  if (typeof image === 'string') return normalizeUrl(image)

  // Boolean true means use local PNG file
  if (image === true) {
    if (slugOrVariant) return `/images/beer/${slugOrVariant}.png`
    return null
  }

  // Payload Media object with url property
  if (typeof image === 'object' && image !== null && 'url' in image) {
    const url = (image as MediaObject).url
    return url ? normalizeUrl(url) : null
  }

  return null
}

/**
 * Get image URL for a location card image
 * Similar to getMediaUrl but returns null instead of undefined
 *
 * @param image - The image field value
 * @returns The normalized URL string, or null if not available
 */
export function getLocationImageUrl(image: unknown): string | null {
  if (!image) return null
  if (typeof image === 'string') return image
  if (typeof image === 'object' && image !== null && 'url' in image) {
    return (image as MediaObject).url || null
  }
  return null
}
