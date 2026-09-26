/**
 * Invalidate the ISR beer page for a beer-reviews document's related beer.
 * Tag invalidation of `beers` is not enough: `/beer/[slug]` is a 3600s ISR
 * route that also needs `revalidatePath`.
 *
 * System code (allowlisted for `overrideAccess: true`): cache invalidation is
 * derived state and must find the beer's slug even when the beer is a draft
 * the triggering user could not read. Pass the hook's `req` so the lookup
 * runs inside the review save's transaction.
 */
import { revalidatePath } from 'next/cache'
import type { Payload, PayloadRequest } from 'payload'
import { relationshipId } from '@/src/utils/relationship-id'
import { logger } from '@/lib/utils/logger'

export async function revalidateBeerPageForReview(
  payload: Payload,
  beer: { id: string; slug?: string | null } | string,
  req: PayloadRequest,
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
            req,
          })).slug

    if (slug) revalidatePath(`/beer/${slug}`)
  } catch (error) {
    logger.error('Beer review page revalidation error:', error)
  }
}
