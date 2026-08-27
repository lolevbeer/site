/**
 * Invalidate the ISR beer page for a beer-reviews document's related beer.
 * Tag invalidation of `beers` is not enough: `/beer/[slug]` is a 3600s ISR
 * route that also needs `revalidatePath`.
 */
import { revalidatePath } from 'next/cache'
import type { Payload } from 'payload'
import { relationshipId } from '@/src/utils/relationship-id'
import { logger } from '@/lib/utils/logger'

export async function revalidateBeerPageForReview(
  payload: Payload,
  beer: { id: string; slug?: string | null } | string,
): Promise<void> {
  try {
    const slug =
      typeof beer === 'object' && beer.slug
        ? beer.slug
        : (await payload.findByID({
            collection: 'beers',
            id: relationshipId(beer),
            depth: 0,
            overrideAccess: true,
          })).slug

    if (slug) revalidatePath(`/beer/${slug}`)
  } catch (error) {
    logger.error('Beer review page revalidation error:', error)
  }
}
