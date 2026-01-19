import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { revalidateTag } from 'next/cache'
import { generateUniqueSlug } from './utils/generateUniqueSlug'
import { adminAccess, beerManagerAccess, isAdmin } from '@/src/access/roles'
import { fetchUntappdData, type UntappdReview } from '@/src/utils/untappd'

// Helper function to round to nearest 0.25 (like Excel's MROUND)
const mround = (value: number, multiple: number): number => {
  return Math.round(value / multiple) * multiple
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

        // Auto-fetch Untappd rating when URL is set/changed
        if (data.untappd && data.untappd !== originalDoc?.untappd) {
          const { rating, ratingCount, positiveReviews } = await fetchUntappdData(data.untappd)
          if (rating !== null) {
            data.untappdRating = rating
          }
          if (ratingCount !== null) {
            data.untappdRatingCount = ratingCount
          }
          if (positiveReviews.length > 0) {
            // Merge with existing reviews, using URL as unique key
            const existingReviews = (originalDoc?.positiveReviews as UntappdReview[]) || []
            const existingUrls = new Set(existingReviews.map(r => r.url).filter(Boolean))
            const newReviews = positiveReviews.filter(r => r.url && !existingUrls.has(r.url))
            data.positiveReviews = [...existingReviews, ...newReviews]
          }
        }

        return data
      },
    ],
    afterChange: [
      async ({ doc, req }) => {
        // Find all menus containing this beer and revalidate their caches
        try {
          const menus = await req.payload.find({
            collection: 'menus',
            where: {
              'items.product.value': { equals: doc.id },
            },
            limit: 100,
            depth: 0,
          })

          // Revalidate each menu's specific cache tag
          for (const menu of menus.docs) {
            if (menu.url) {
              revalidateTag(`menu-${menu.url}`)
            }
          }
        } catch (error) {
          // Don't block the save if revalidation fails
          console.error('Beer menu revalidation error:', error)
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
        readOnly: true,
      },
    },
  ],
}
