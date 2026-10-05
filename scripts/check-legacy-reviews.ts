/**
 * Read-only pre-check for removing the legacy `positiveReviews` fallback on
 * beer pages (docs/plans/follow-access-control.md, Task 7). Lists beers that
 * still carry legacy review JSON but have no normalized `beer-reviews` docs —
 * those beers would lose their reviews once the fallback goes.
 *
 * Run: pnpm payload run scripts/check-legacy-reviews.ts   (DATABASE_URI → target DB)
 */
import { getPayload } from 'payload'
import config from '@/src/payload.config'

const payload = await getPayload({ config })

const beers = await payload.find({
  collection: 'beers',
  where: { positiveReviews: { exists: true } },
  select: { name: true, slug: true, positiveReviews: true },
  depth: 0,
  pagination: false,
  draft: true,
  overrideAccess: true,
})

const withLegacy = beers.docs.filter(
  (beer) => Array.isArray(beer.positiveReviews) && beer.positiveReviews.length > 0,
)

const missing: string[] = []
for (const beer of withLegacy) {
  const normalized = await payload.find({
    collection: 'beer-reviews',
    where: { beer: { equals: beer.id } },
    select: { sourceUrl: true },
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  const urls = new Set(normalized.docs.map((review) => review.sourceUrl))
  const legacy = beer.positiveReviews as { url?: string; text?: string }[]
  const absent = new Set(
    legacy
      .filter((review) => review.url && review.text && !urls.has(review.url))
      .map((review) => review.url),
  )
  if (absent.size) missing.push(`${beer.slug} (${beer.name}): ${absent.size} missing review(s)`)
}

console.log(`Beers with legacy positiveReviews: ${withLegacy.length}`)
console.log(`...of those, with missing normalized review URLs: ${missing.length}`)
for (const line of missing) console.log(`  - ${line}`)

process.exit(missing.length ? 1 : 0)
