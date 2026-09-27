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
  const { totalDocs } = await payload.count({
    collection: 'beer-reviews',
    where: { beer: { equals: beer.id } },
    overrideAccess: true,
  })
  if (totalDocs === 0) missing.push(`${beer.slug} (${beer.name})`)
}

console.log(`Beers with legacy positiveReviews: ${withLegacy.length}`)
console.log(`...of those, with zero beer-reviews docs: ${missing.length}`)
for (const line of missing) console.log(`  - ${line}`)

process.exit(0)
