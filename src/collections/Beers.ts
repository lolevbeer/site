import type { CollectionConfig, Payload } from 'payload'
import { APIError } from 'payload'
import { revalidateTag } from 'next/cache'
import { generateUniqueSlug } from './utils/generateUniqueSlug'
import { adminAccess, beerManagerAccess } from '@/src/access/roles'
import { fetchUntappdData, type UntappdReview } from '@/src/utils/untappd'
import { logger } from '@/lib/utils/logger'

/** Round to nearest multiple (like Excel's MROUND) */
function mround(value: number, multiple: number): number {
  return Math.round(value / multiple) * multiple
}

/**
 * Find all menus containing a given beer and revalidate their CDN cache tags.
 * Called from both afterChange (data updated) and afterRead (editor warm-up).
 */
async function revalidateMenusForBeer(
  payload: Payload,
  beerId: string | number,
): Promise<void> {
  const menus = await payload.find({
    collection: 'menus',
    where: { 'items.product.value': { equals: beerId } },
    limit: 100,
    depth: 0,
  })
  for (const menu of menus.docs) {
    if (menu.url) {
      revalidateTag(`menu-${menu.url}`)
    }
  }
}

export const Beers: CollectionConfig = {
  slug: 'beers',
  access: {
    read: () => true,
    create: beerManagerAccess,
    update: beerManagerAccess,
    delete: adminAccess, // Beer Managers can only archive, not delete
  },
  admin: {
    group: 'Back of House',
    useAsTitle: 'name',
    hideAPIURL: true,
    listSearchableFields: ['name', 'slug'],
    defaultColumns: ['name', 'slug', 'style', 'abv', 'hideFromSite'],
    pagination: {
      defaultLimit: 100,
    },
    preview: (doc) => {
      if (doc?.slug) {
        return `/beer/${doc.slug}`
      }
      return ''
    },
  },
  versions: {
    drafts: true,
  },
  hooks: {
    beforeChange: [
      async ({ data, req, operation, originalDoc }) => {
        // Compute canSingle from fourPack: MROUND((fourPack/4) + 0.25, 0.25)
        if (data.fourPack && typeof data.fourPack === 'number') {
          data.canSingle = mround((data.fourPack / 4) + 0.25, 0.25)
        }

        // Compute halfPour from draftPrice: round(draftPrice / 2) + 1
        // Skip auto-calculation if halfPourOnly is enabled (manual override)
        if (data.draftPrice && typeof data.draftPrice === 'number' && !data.halfPourOnly) {
          data.halfPour = Math.round(data.draftPrice / 2) + 1
        }

        // Auto-generate slug from name if not provided or empty
        if ((!data.slug || data.slug.trim() === '') && data.name && typeof data.name === 'string') {
          // For updates, use originalDoc.id; for creates, use data.id if available
          const docId = originalDoc?.id || data.id
          data.slug = await generateUniqueSlug(
            data.name,
            'beers',
            req,
            operation,
            docId,
          )
        }

        // Auto-increment recipe number for new beers (always, even when cloning)
        if (operation === 'create') {
          const lastBeer = await req.payload.find({
            collection: 'beers',
            sort: '-recipe',
            limit: 1,
            overrideAccess: true,
          })

          if (lastBeer.docs.length > 0 && lastBeer.docs[0].recipe) {
            data.recipe = lastBeer.docs[0].recipe + 1
          } else {
            data.recipe = 1
          }
        }

        // Validate recipe number is unique (on create or when changed)
        if (data.recipe !== undefined && data.recipe !== originalDoc?.recipe) {
          const existing = await req.payload.find({
            collection: 'beers',
            where: {
              recipe: { equals: data.recipe },
              id: { not_equals: originalDoc?.id },
            },
            limit: 1,
            overrideAccess: true,
          })

          if (existing.docs.length > 0) {
            throw new APIError(
              `Recipe number ${data.recipe} is already in use by "${existing.docs[0].name}"`,
              400,
            )
          }
        }

        // Auto-fetch Untappd rating when URL is set or changed
        if (data.untappd && data.untappd !== originalDoc?.untappd) {
          const fetched = await fetchUntappdData(data.untappd)

          if (fetched.rating !== null) data.untappdRating = fetched.rating
          if (fetched.ratingCount !== null) data.untappdRatingCount = fetched.ratingCount

          if (fetched.positiveReviews.length > 0) {
            // Merge new reviews with existing, using URL as the dedup key
            const existing = (originalDoc?.positiveReviews as UntappdReview[]) || []
            const existingUrls = new Set(existing.map((r) => r.url).filter(Boolean))
            const newReviews = fetched.positiveReviews.filter(
              (r) => r.url && !existingUrls.has(r.url),
            )
            data.positiveReviews = [...existing, ...newReviews]
          }
        }

        return data
      },
    ],
    afterChange: [
      async ({ doc, req }) => {
        try {
          await revalidateMenusForBeer(req.payload, doc.id)
        } catch (error) {
          logger.error('Beer menu revalidation error:', error)
        }
        return doc
      },
    ],
    afterRead: [
      async ({ doc, req, findMany }) => {
        // When an admin views a single beer, revalidate menu caches so
        // displays snap back to fast polling in anticipation of edits.
        // Skip list views (findMany) to avoid N+1 queries.
        if (req.user && !findMany) {
          try {
            await revalidateMenusForBeer(req.payload, doc.id)
          } catch {
            // Don't block the read
          }
        }
        return doc
      },
    ],
  },
  fields: [
    {
      name: 'glass',
      type: 'select',
      required: true,
      options: [
        { label: 'Pint', value: 'pint' },
        { label: 'Stein', value: 'stein' },
        { label: 'Teku', value: 'teku' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'abv',
      label: 'ABV',
      type: 'number',
      required: true,
      min: 0,
      max: 20,
      admin: {
        step: 0.1,
        description: 'Alcohol by volume percentage',
        position: 'sidebar',
      },
    },
    {
      name: 'draftPrice',
      type: 'number',
      required: true,
      admin: {
        description: 'Draft price in dollars (e.g., 7)',
        position: 'sidebar',
        step: 0.25,
      },
    },
    {
      name: 'halfPourOnly',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Enable to manually set half pour price (disables auto-calculation)',
        position: 'sidebar',
      },
    },
    {
      name: 'halfPour',
      type: 'number',
      admin: {
        description: 'Auto-calculated unless "Half Pour Only" is enabled',
        position: 'sidebar',
        step: 0.25,
      },
    },
    {
      name: 'fourPack',
      type: 'number',
      admin: {
        description: 'Four pack price (e.g., 15)',
        position: 'sidebar',
        step: 0.25,
      },
    },
    {
      name: 'bottlePrice',
      type: 'number',
      admin: {
        description: 'Bottle price (e.g., 12)',
        position: 'sidebar',
        step: 0.25,
      },
    },
    {
      name: 'canSingle',
      type: 'number',
      admin: {
        description: 'Auto-calculated from four pack price',
        position: 'sidebar',
        readOnly: true,
        step: 0.01,
      },
    },
    {
      name: 'upc',
      label: 'UPC',
      type: 'text',
      admin: {
        description: 'UPC barcode',
        position: 'sidebar',
      },
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      required: true,
      admin: {
        description: 'Auto-generated from name, but you can override it manually',
        position: 'sidebar',
      },
    },
    {
      name: 'recipe',
      type: 'number',
      unique: true,
      admin: {
        description: 'Auto-incremented recipe number',
        position: 'sidebar',
      },
    },
    {
      name: 'hideFromSite',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'justReleased',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Mark as "Just Released". If no beers have this set, beers created within 2 weeks are auto-marked.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          admin: {
            width: '25%',
          },
        },
        {
          name: 'style',
          type: 'relationship',
          relationTo: 'styles',
          required: true,
          index: true,
          admin: {
            description: 'Beer style',
            width: '25%',
          },
        },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description: 'Beer image (recommended: 2500x2500px)',
            width: '50%',
          },
        },
      ],
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'hops',
      type: 'text',
      admin: {
        description: 'Hop varieties used',
      },
    },
    {
      name: 'untappdFetcher',
      type: 'ui',
      admin: {
        components: {
          Field: '@/src/components/admin/UntappdFetcher#UntappdFetcher',
        },
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'untappd',
          type: 'text',
          admin: {
            description: 'Untappd URL (e.g., /b/lolev-beer-lupula/123456)',
            width: '50%',
          },
        },
        {
          name: 'untappdRating',
          type: 'number',
          admin: {
            description: 'Rating (auto-fetched)',
            readOnly: true,
            step: 0.01,
            width: '25%',
          },
        },
        {
          name: 'untappdRatingCount',
          type: 'number',
          admin: {
            description: 'Rating count (auto-fetched)',
            readOnly: true,
            width: '25%',
          },
        },
      ],
    },
    {
      name: 'positiveReviews',
      type: 'json',
      admin: {
        description: 'MGR agent approved reviews',
        components: {
          Field: '@/src/components/admin/ReviewManager#ReviewManager',
        },
      },
    },
  ],
}
