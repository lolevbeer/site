/**
 * Beer review normalization between the legacy `beers.positiveReviews` JSON
 * and `beer-reviews` documents.
 *
 * `syncBeerReviews` and `pruneLegacyReview` are system code (allowlisted for
 * `overrideAccess: true`): they maintain derived data and must see every doc
 * whoever triggered them — including the user-less Untappd job and migrations.
 * They require the caller's `req` so their writes join its transaction.
 */
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
  req: PayloadRequest
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
 * sync that touches the beer.
 *
 * Returns the beer's id and slug when the document was found, so the caller can
 * revalidate its page without reading the same document a second time.
 */
export async function pruneLegacyReview({
  beer,
  payload,
  req,
  sourceUrl,
}: {
  beer: BeerReview['beer'] | null | undefined
  payload: Payload
  req: PayloadRequest
  sourceUrl: string | null | undefined
}): Promise<{ id: string; slug?: string | null } | null> {
  if (!beer || !sourceUrl) return null
  const beerId = relationshipId(beer)
  if (!beerId) return null

  const doc = await payload.findByID({
    collection: 'beers',
    id: beerId,
    depth: 0,
    overrideAccess: true,
    req,
  })
  if (!doc) return null

  const legacy = doc.positiveReviews
  if (Array.isArray(legacy)) {
    const remaining = (legacy as LegacyUntappdReview[]).filter((review) => review.url !== sourceUrl)
    if (remaining.length !== legacy.length) {
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
  }

  return { id: String(doc.id), slug: doc.slug }
}

/**
 * Public review list for one beer, in the legacy `positiveReviews` shape the
 * beer page and product schema already render.
 *
 * This is the file's one public read: it runs as an anonymous visitor, so
 * `canReadBeerReviews` limits it to approved docs. beer-reviews documents are
 * the only source — there is no fallback to the legacy JSON, so a beer with no
 * approved docs gets an empty list.
 */
export async function getPublicBeerReviews(
  payload: Payload,
  beerId: string,
): Promise<LegacyUntappdReview[]> {
  const reviews = await payload.find({
    collection: 'beer-reviews',
    where: { beer: { equals: beerId } },
    depth: 0,
    limit: 100,
    sort: '-reviewedAt',
    overrideAccess: false,
  })

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
