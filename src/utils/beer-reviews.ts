import type { Payload, PayloadRequest } from 'payload'
import type { BeerReview } from '@/src/payload-types'
import type { UntappdReview } from '@/src/utils/untappd'
import { relationshipId } from '@/src/utils/relationship-id'

export interface LegacyUntappdReview extends UntappdReview {
  hidden?: boolean
}

interface SyncBeerReviewsArgs {
  beerId: string
  payload: Payload
  req?: PayloadRequest
  reviews: LegacyUntappdReview[]
}

function reviewedAt(value?: string): string | undefined {
  if (!value) return undefined
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? undefined : new Date(timestamp).toISOString()
}

export async function syncBeerReviews({
  beerId,
  payload,
  req,
  reviews,
}: SyncBeerReviewsArgs): Promise<number> {
  const bySourceUrl = new Map(
    reviews
      .filter((review): review is LegacyUntappdReview & { url: string } =>
        Boolean(review.url && review.text),
      )
      .map((review) => [review.url, review]),
  )

  if (bySourceUrl.size === 0) return 0

  const existing = await payload.find({
    collection: 'beer-reviews',
    where: { sourceUrl: { in: [...bySourceUrl.keys()] } },
    depth: 0,
    limit: bySourceUrl.size,
    overrideAccess: true,
    req,
  })
  const existingByUrl = new Map(existing.docs.map((review) => [review.sourceUrl, review]))
  let writes = 0

  for (const [sourceUrl, review] of bySourceUrl) {
    const current = existingByUrl.get(sourceUrl)
    const normalized = {
      beer: beerId,
      reviewer: review.username || 'Anonymous',
      rating: review.rating,
      text: review.text,
      reviewedAt: reviewedAt(review.date),
      sourceDate: review.date,
      source: 'untappd' as const,
      sourceUrl,
      externalImageUrl: review.image,
    }

    if (!current) {
      await payload.create({
        collection: 'beer-reviews',
        data: {
          ...normalized,
          approved: review.hidden !== true,
        },
        context: { skipRevalidate: true },
        overrideAccess: true,
        req,
      })
      writes++
      continue
    }

    const currentBeerId = relationshipId(current.beer)
    const hasChanged =
      currentBeerId !== beerId ||
      current.reviewer !== normalized.reviewer ||
      current.rating !== normalized.rating ||
      current.text !== normalized.text ||
      (current.reviewedAt || undefined) !== normalized.reviewedAt ||
      (current.sourceDate || undefined) !== normalized.sourceDate ||
      (current.externalImageUrl || undefined) !== normalized.externalImageUrl

    if (hasChanged) {
      await payload.update({
        collection: 'beer-reviews',
        id: current.id,
        data: normalized,
        context: { skipRevalidate: true },
        overrideAccess: true,
        req,
      })
      writes++
    }
  }

  return writes
}

/**
 * Remove a deleted review from the beer's legacy `positiveReviews` JSON.
 *
 * The legacy array is a second copy of the same data that `syncBeerReviews`
 * reads back, so leaving a deleted review in it would re-create the document —
 * approved, since legacy entries carry no `hidden` flag — on the next Untappd
 * sync that touches the beer. Pruning also keeps `getPublicBeerReviews`'s
 * "no documents => not normalized yet" fallback honest: emptying a beer's
 * review set now renders nothing instead of resurrecting the legacy list.
 */
export async function pruneLegacyReview({
  beer,
  payload,
  req,
  sourceUrl,
}: {
  beer: BeerReview['beer'] | null | undefined
  payload: Payload
  req?: PayloadRequest
  sourceUrl: string | null | undefined
}): Promise<void> {
  if (!beer || !sourceUrl) return
  const beerId = relationshipId(beer)
  if (!beerId) return

  const doc = await payload.findByID({
    collection: 'beers',
    id: beerId,
    depth: 0,
    overrideAccess: true,
    req,
  })

  const legacy = doc?.positiveReviews
  if (!Array.isArray(legacy)) return

  const remaining = (legacy as LegacyUntappdReview[]).filter((review) => review.url !== sourceUrl)
  if (remaining.length === legacy.length) return

  await payload.update({
    collection: 'beers',
    id: beerId,
    data: { positiveReviews: remaining },
    // skipReviewSync: this write *is* the review sync; re-entering it would
    // immediately re-create the document we just deleted.
    context: { skipRevalidate: true, skipReviewSync: true },
    overrideAccess: true,
    req,
  })
}

/**
 * Public review list for one beer, in the legacy `positiveReviews` shape the
 * beer page and product schema already render.
 *
 * Returns `null` when the beer has no normalized review documents at all, so
 * callers can keep serving the legacy JSON until the normalization migration
 * has run for that beer. Once documents exist they are authoritative:
 * unapproving a beer-reviews document removes it from the public page and the
 * Product schema, and deleting one prunes the legacy copy too
 * (see `pruneLegacyReview`) so it cannot come back through the fallback.
 */
export async function getPublicBeerReviews(
  payload: Payload,
  beerId: string,
): Promise<LegacyUntappdReview[] | null> {
  const reviews = await payload.find({
    collection: 'beer-reviews',
    where: { beer: { equals: beerId } },
    depth: 0,
    limit: 100,
    sort: '-reviewedAt',
    overrideAccess: true,
  })

  if (reviews.docs.length === 0) return null

  return reviews.docs.filter((review) => review.approved).map(reviewToLegacy)
}

export function reviewToLegacy(review: BeerReview): LegacyUntappdReview {
  return {
    username: review.reviewer,
    rating: review.rating,
    text: review.text,
    date: review.sourceDate || review.reviewedAt || undefined,
    url: review.sourceUrl,
    image: review.externalImageUrl || undefined,
    hidden: !review.approved,
  }
}
