import type { Access, CollectionConfig, Field, PayloadRequest, Where } from 'payload'
import { APIError } from 'payload'
import { revalidateTag } from 'next/cache'
import { publishKioskInvalidate } from '@/lib/ably/publish'
import { generateUniqueSlug } from './utils/generateUniqueSlug'
import { updatedByField } from './utils/updatedByField'
import { adminAccess, beerManagerAccess, beerManagerFieldAccess, hasRole } from '@/src/access/roles'
import { fetchUntappdData, type UntappdReview } from '@/src/utils/untappd'
import { logger } from '@/lib/utils/logger'
import { syncBeerReviews, type LegacyUntappdReview } from '@/src/utils/beer-reviews'
import { documentSeoField } from '@/src/fields/seo'

/** Round to nearest multiple (like Excel's MROUND) */
function mround(value: number, multiple: number): number {
  return Math.round(value / multiple) * multiple
}

/**
 * Find all menus containing a given beer and revalidate their CDN cache tags.
 * Called from afterChange so menu displays pick up beer edits on their next poll.
 * System lookup: reads every menu regardless of the editor's own menus access
 * (derived cache state, not something the editor is shown), inside the save's
 * transaction via `req`.
 *
 * NOTE: This must never run from an afterRead hook. Payload's admin form-state
 * requests (stale-data check, document locking, relationship population) read
 * docs through Next.js Server Actions, and calling revalidateTag inside a
 * Server Action forces the admin router to refetch — resetting the edit form.
 */
async function revalidateMenusForBeer(req: PayloadRequest, beerId: string | number): Promise<void> {
  const menus = await req.payload.find({
    collection: 'menus',
    where: { 'items.product.value': { equals: beerId } },
    limit: 100,
    depth: 0,
    // eslint-disable-next-line no-restricted-syntax -- system: cache invalidation must find every menu listing the beer; the editor's menus read can be location-scoped (beer-manager + bartender) or empty
    overrideAccess: true,
    req,
  })
  for (const menu of menus.docs) {
    if (menu.url) {
      revalidateTag(`menu-${menu.url}`, 'max')
      void publishKioskInvalidate({ kind: 'menu', key: menu.url })
    }
  }
}

/**
 * Upload field owned by the 3D label generator (labelBase/labelMetalness/
 * labelVideo). admin.readOnly is UI-only — LabelTextureGenerator still
 * populates the value programmatically via useField().setValue. Do NOT
 * tighten these to field-level access.update: that would make generation
 * silently stop persisting on save.
 */
const generatedUploadField = (name: string, description: string): Field => ({
  name,
  type: 'upload',
  relationTo: 'media',
  admin: {
    description,
    width: '50%',
    readOnly: true,
  },
})

/**
 * Read access for beers, in three cases:
 *
 * 1. Staff who handle beer (admin, beer-manager, bartender, lead-bartender)
 *    read every beer, drafts included.
 * 2. Anyone else asking for drafts gets nothing. Payload's `draft` flag never
 *    reaches access functions, so the REST request is inspected instead:
 *    `?draft=true` (`req.query.draft`, boolean after the find handler parses
 *    it, the raw string on findByID) or a method-override body
 *    (`req.data.draft`). GraphQL rewrites `req.query.draft` unreliably, so
 *    GraphQL reads stay published-only, which is also safe in draft mode.
 *    A Local API `draft: true` leaves no trace on `req`; server code must not
 *    request drafts on a visitor's behalf. The guard is still needed with
 *    case 3: Payload's draft lookup (`replaceWithDraftIfAvailable`) only
 *    checks read access, so without it `?draft=true` on a published beer
 *    would return its unpublished edits.
 * 3. Otherwise: published beers only. Drafts never show on the public site,
 *    even when a draft beer sits on a published menu or Coming Soon; publish
 *    the beer to make it public.
 */
export const canReadBeers: Access = ({ req }) => {
  if (hasRole(req.user, ['admin', 'beer-manager', 'bartender', 'lead-bartender'])) return true

  const published: Where = { _status: { equals: 'published' } }
  if (req.payloadAPI === 'GraphQL') return published

  const isTrue = (value: unknown) => value === true || value === 'true'
  if (isTrue(req.query?.draft) || isTrue(req.data?.draft)) return false

  return published
}

export const Beers: CollectionConfig = {
  slug: 'beers',
  access: {
    read: canReadBeers,
    // Version history holds unpublished edits, so only beer managers see it.
    readVersions: beerManagerAccess,
    create: beerManagerAccess,
    update: beerManagerAccess,
    delete: adminAccess, // Beer Managers can only archive, not delete
  },
  admin: {
    group: 'Back of House',
    useAsTitle: 'name',
    listSearchableFields: ['name', 'slug'],
    defaultColumns: ['name', 'slug', 'style', 'abv', 'hideFromSite'],
    components: {
      views: {
        edit: {
          versions: { Component: '@/src/components/admin/VersionsWithEditor#VersionsWithEditor' },
        },
      },
    },
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
          data.canSingle = mround(data.fourPack / 4 + 0.25, 0.25)
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
          data.slug = await generateUniqueSlug(data.name, 'beers', req, operation, docId)
        }

        // Auto-increment recipe number for new beers (always, even when cloning)
        if (operation === 'create') {
          const lastBeer = await req.payload.find({
            collection: 'beers',
            sort: '-recipe',
            limit: 1,
            // eslint-disable-next-line no-restricted-syntax -- system: next recipe number must count every beer, drafts included
            overrideAccess: true,
            req,
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
            // eslint-disable-next-line no-restricted-syntax -- system: recipe uniqueness invariant spans every beer, drafts included
            overrideAccess: true,
            req,
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
      async ({ context, doc, previousDoc, req }) => {
        // Only normalize reviews when the legacy JSON actually changed —
        // ordinary edits (price, description, publish) skip the extra queries.
        const reviewsChanged =
          JSON.stringify(doc.positiveReviews ?? null) !==
          JSON.stringify(previousDoc?.positiveReviews ?? null)
        if (!context?.skipReviewSync && reviewsChanged && Array.isArray(doc.positiveReviews)) {
          try {
            await syncBeerReviews({
              beerId: doc.id,
              payload: req.payload,
              req,
              reviews: doc.positiveReviews as LegacyUntappdReview[],
            })
          } catch (error) {
            logger.error('Beer review normalization error:', error)
          }
        }

        if (context?.skipRevalidate) return doc

        try {
          await revalidateMenusForBeer(req, doc.id)
        } catch (error) {
          logger.error('Beer menu revalidation error:', error)
        }
        return doc
      },
    ],
  },
  // Layout: unnamed tabs, rows, and collapsibles are presentational only —
  // every field below still stores at the top level of the beer document.
  // The sidebar holds the per-release flags (hide, collab), the identifiers
  // (slug, recipe), and the read-only updatedBy stamp.
  fields: [
    updatedByField,
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Details',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'name',
                  type: 'text',
                  required: true,
                },
                {
                  name: 'style',
                  type: 'relationship',
                  relationTo: 'styles',
                  required: true,
                  index: true,
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'glass',
                  type: 'select',
                  required: true,
                  options: [
                    { label: 'Pint', value: 'pint' },
                    { label: 'Stein', value: 'stein' },
                    { label: 'Teku', value: 'teku' },
                    { label: 'UHA', value: 'uha' },
                  ],
                },
                {
                  name: 'abv',
                  label: 'ABV (%)',
                  type: 'number',
                  required: true,
                  min: 0,
                  max: 20,
                  admin: {
                    step: 0.1,
                  },
                },
              ],
            },
            {
              name: 'description',
              type: 'textarea',
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'hops',
                  type: 'text',
                  admin: {
                    placeholder: 'e.g. Citra, Mosaic',
                  },
                },
                {
                  // Single-value tag: relationship gives a typeahead over existing tags
                  // plus inline "Add new" creation. hasMany defaults to false, so only
                  // one tag is allowed per beer.
                  name: 'tag',
                  type: 'relationship',
                  relationTo: 'tags',
                  index: true,
                  admin: {
                    description: 'Optional (search existing or add a new one)',
                  },
                },
              ],
            },
          ],
        },
        {
          label: 'Pricing',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'draftPrice',
                  type: 'number',
                  required: true,
                  admin: {
                    placeholder: 'e.g. 7',
                    step: 0.25,
                  },
                },
                {
                  name: 'halfPour',
                  type: 'number',
                  admin: {
                    description:
                      'Set automatically from the draft price unless "Half Pour Only" is on',
                    step: 0.25,
                  },
                },
              ],
            },
            {
              name: 'halfPourOnly',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                description:
                  'Served in half pours only: hides the full draft price on the site and uses the half pour price above as entered.',
              },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'fourPack',
                  type: 'number',
                  admin: {
                    placeholder: 'e.g. 15',
                    step: 0.25,
                    width: '50%',
                  },
                },
                {
                  name: 'canSingle',
                  type: 'number',
                  admin: {
                    condition: (data) => typeof data?.fourPack === 'number',
                    description: 'Set automatically from the four pack price',
                    readOnly: true,
                    step: 0.01,
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'bottlePrice',
                  type: 'number',
                  admin: {
                    placeholder: 'e.g. 12',
                    step: 0.25,
                  },
                },
                {
                  name: 'upc',
                  label: 'UPC',
                  type: 'text',
                },
              ],
            },
          ],
        },
        {
          label: 'Label & images',
          fields: [
            {
              // Drop-zone + button that runs the PDF→texture pipeline in the admin
              // browser and fills in the generated files below.
              name: 'labelTextures',
              type: 'ui',
              admin: {
                components: {
                  Field: '@/src/components/admin/LabelTextureGenerator#LabelTextureGenerator',
                },
              },
            },
            {
              name: 'image',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description: 'Beer image (auto-filled by the 3D label tool; upload to override)',
              },
            },
            {
              type: 'collapsible',
              label: 'Generated label files',
              admin: {
                initCollapsed: true,
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    generatedUploadField('labelBase', 'Generated 3D label texture'),
                    generatedUploadField(
                      'labelMetalness',
                      'Generated metalness map (white = metallic foil)',
                    ),
                  ],
                },
                generatedUploadField(
                  'labelVideo',
                  'Generated can-rotation sprite sheet (PNG; animated in CSS on menu displays)',
                ),
              ],
            },
          ],
        },
        {
          label: 'Untappd & reviews',
          fields: [
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
              name: 'topBeerDrops',
              type: 'text',
              admin: {
                description: 'Top Beer Drops URL (e.g., https://topbeerdrops.com/...)',
              },
            },
            {
              name: 'reviews',
              type: 'join',
              collection: 'beer-reviews',
              on: 'beer',
              defaultSort: '-reviewedAt',
              defaultLimit: 25,
              maxDepth: 1,
              admin: {
                allowCreate: true,
                defaultColumns: ['reviewer', 'rating', 'approved', 'reviewedAt'],
              },
            },
          ],
        },
      ],
    },
    {
      name: 'hideFromSite',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description:
          'Hide from the /beer catalog (and sitemap/feeds). Usually for guest beers. Does NOT hide the beer from menu displays (/m).',
      },
    },
    {
      name: 'collab',
      label: 'Collab',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description:
          'Collaboration brew with another brewery. Shows a "Collab" badge instead of the automatic "Just Released" one.',
      },
    },
    {
      name: 'collabBrewery',
      label: 'Collaborating Brewery',
      type: 'text',
      admin: {
        position: 'sidebar',
        condition: (data) => data?.collab === true,
        description: 'Brewery name shown in the collaboration badge. Leave blank to show “Collab”.',
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
        description:
          'Assigned automatically to new beers; change only to fix a mistake (must be unique)',
        position: 'sidebar',
      },
    },
    {
      name: 'positiveReviews',
      type: 'json',
      access: {
        read: beerManagerFieldAccess,
      },
      admin: {
        hidden: true,
        description: 'Legacy review data retained temporarily for migration compatibility.',
      },
    },
    documentSeoField,
  ],
}
