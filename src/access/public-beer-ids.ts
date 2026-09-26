/**
 * IDs of beers the public may read even though they are not published: any
 * beer on a published menu or listed on the Coming Soon global. `canReadBeers`
 * ORs these into its published-only rule, so a drafted beer that is on tap
 * still populates on menus instead of degrading to a bare ID.
 *
 * This is the access layer's only `overrideAccess: true`: deciding what the
 * public may see requires reading every published menu regardless of who asks.
 * Both reads use `depth: 0`, so they never populate beers and cannot re-enter
 * `canReadBeers`.
 */
import type { PayloadRequest } from 'payload'
import { relationshipId } from '@/src/utils/relationship-id'

/** `req.context` key holding this request's lookup, so it runs once per request. */
const CONTEXT_KEY = 'accessPublicBeerIds'

async function loadPublicBeerIds(req: PayloadRequest): Promise<string[]> {
  const menus = await req.payload.find({
    collection: 'menus',
    where: { _status: { equals: 'published' } },
    select: { items: { product: true } },
    depth: 0,
    pagination: false,
    // eslint-disable-next-line no-restricted-syntax -- system: access rule must see every menu to decide public beers
    overrideAccess: true,
    req,
  })
  const comingSoon = await req.payload.findGlobal({
    slug: 'coming-soon',
    select: { beers: { beer: true } },
    depth: 0,
    // eslint-disable-next-line no-restricted-syntax -- system: access rule must see every menu to decide public beers
    overrideAccess: true,
    req,
  })

  const ids = new Set<string>()
  for (const menu of menus.docs) {
    for (const item of menu.items ?? []) {
      if (item.product?.relationTo === 'beers') ids.add(relationshipId(item.product.value))
    }
  }
  for (const entry of comingSoon.beers ?? []) {
    if (entry.beer) ids.add(relationshipId(entry.beer))
  }
  return [...ids]
}

/**
 * Beer IDs on published menus or Coming Soon, memoized on `req.context` so the
 * many access checks in one request (list read plus relationship population)
 * share a single lookup. The promise itself is cached so concurrent checks
 * don't race to query.
 */
export function getPublicBeerIds(req: PayloadRequest): Promise<string[]> {
  const cached = req.context[CONTEXT_KEY] as Promise<string[]> | undefined
  if (cached) return cached
  const pending = loadPublicBeerIds(req)
  req.context[CONTEXT_KEY] = pending
  return pending
}
