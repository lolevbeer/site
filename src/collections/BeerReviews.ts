import type { Access, CollectionConfig } from 'payload'
import { beerManagerAccess, hasRole } from '@/src/access/roles'
import { pruneLegacyReview } from '@/src/utils/beer-reviews'
import { revalidateBeerPageForReview } from '@/src/utils/revalidate-beer-page'
import { logger } from '@/lib/utils/logger'

const canReadBeerReviews: Access = ({ req: { user } }) => {
  if (hasRole(user, ['admin', 'beer-manager'])) return true

  return {
    approved: {
      equals: true,
    },
  }
}

export const BeerReviews: CollectionConfig = {
  slug: 'beer-reviews',
  labels: {
    singular: 'Beer Review',
    plural: 'Beer Reviews',
  },
  admin: {
    group: 'Back of House',
    useAsTitle: 'reviewer',
    hideAPIURL: true,
    defaultColumns: ['reviewer', 'beer', 'rating', 'approved', 'reviewedAt'],
  },
  access: {
    read: canReadBeerReviews,
    create: beerManagerAccess,
    update: beerManagerAccess,
    delete: beerManagerAccess,
  },
  hooks: {
    afterChange: [
      async ({ context, doc, req }) => {
        if (context?.skipRevalidate) return doc
        await revalidateBeerPageForReview(req.payload, doc.beer)
        return doc
      },
    ],
    afterDelete: [
      async ({ context, doc, req }) => {
        // Drop the legacy copy first, otherwise the next Untappd sync that
        // touches this beer re-creates the review from `beer.positiveReviews`.
        if (!context?.skipReviewSync) {
          try {
            await pruneLegacyReview({
              beer: doc.beer,
              payload: req.payload,
              req,
              sourceUrl: doc.sourceUrl,
            })
          } catch (error) {
            logger.error('Beer review legacy prune error:', error)
          }
        }

        if (context?.skipRevalidate) return doc
        await revalidateBeerPageForReview(req.payload, doc.beer)
        return doc
      },
    ],
  },
  fields: [
    {
      name: 'beer',
      type: 'relationship',
      relationTo: 'beers',
      required: true,
      index: true,
    },
    {
      name: 'reviewer',
      type: 'text',
      required: true,
    },
    {
      name: 'rating',
      type: 'number',
      required: true,
      min: 0,
      max: 5,
      admin: {
        step: 0.25,
      },
    },
    {
      name: 'text',
      type: 'textarea',
      required: true,
    },
    {
      name: 'reviewedAt',
      type: 'date',
      index: true,
      admin: {
        date: {
          displayFormat: 'MMM d, yyyy',
        },
      },
    },
    {
      name: 'sourceDate',
      type: 'text',
      admin: {
        description:
          'Original date text supplied by Untappd when an exact timestamp is unavailable.',
      },
    },
    {
      name: 'source',
      type: 'select',
      required: true,
      defaultValue: 'untappd',
      options: [{ label: 'Untappd', value: 'untappd' }],
    },
    {
      name: 'sourceUrl',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'externalImageUrl',
      type: 'text',
    },
    {
      name: 'approved',
      type: 'checkbox',
      required: true,
      defaultValue: true,
      index: true,
      admin: {
        position: 'sidebar',
        description: 'Approved reviews can be included in public beer data.',
      },
    },
  ],
}
