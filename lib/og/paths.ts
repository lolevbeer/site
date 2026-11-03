/**
 * Where generated social cards live and how big they are. Kept apart from card.tsx
 * so page modules can build metadata without importing the renderer (next/og, node:fs).
 */

export const OG_SIZE = { width: 1200, height: 630 }

/**
 * Open Graph `images` entry pointing at the generated card for a beer, taproom, or event.
 * `slug` is the beer/taproom slug or the event id (both URL-safe: [a-z0-9-]).
 */
export const ogCardImages = (kind: 'beer' | 'location' | 'event', slug: string, alt: string) => [
  { url: `/og/${kind}/${slug}`, ...OG_SIZE, alt },
]
