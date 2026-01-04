/**
 * Media utility functions
 * Consolidated image/media URL extraction for Payload CMS
 */

import { normalizeUrl } from './url-utils'

/**
 * Type for Payload Media objects
 * Matches the essential fields from Payload's Media collection
 */
interface MediaObject {
  url?: string | null
  thumbnailURL?: string | null
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
export function getMediaUrl(media: unknown): string | undefined {
  if (!media) return undefined

  // Just an ID reference, not a populated Media object
  if (typeof media === 'string') return undefined

  // Check if it's a Media object with a url property
  if (typeof media === 'object' && media !== null && 'url' in media) {
    const url = (media as MediaObject).url
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
export function getBeerImageUrl(
  image: unknown,
  slugOrVariant?: string
): string | null {
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
