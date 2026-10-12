/**
 * Active taprooms a public form may name (donate, /events inquiries): every
 * location not marked inactive that has a slug. Read as the anonymous visitor.
 */

import type { Payload } from 'payload'
import type { Location } from '@/src/payload-types'

export async function findActiveTaprooms(
  payload: Payload,
): Promise<Array<Location & { slug: string }>> {
  const result = await payload.find({
    collection: 'locations',
    where: { active: { not_equals: false } },
    limit: 50,
    depth: 0,
    // Anonymous visitor: locations are publicly readable.
    overrideAccess: false,
  })
  return result.docs.filter(
    (doc): doc is Location & { slug: string } => typeof doc.slug === 'string' && doc.slug.length > 0,
  )
}
