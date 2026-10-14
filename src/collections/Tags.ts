import type { CollectionConfig } from 'payload'
import { adminAccess, beerManagerAccess } from '@/src/access/roles'

/**
 * Tags collection — a simple list of reusable, single-value labels for beers.
 *
 * Surfaced on Beers via a single (`hasMany: false`) relationship field, which
 * gives the admin a typeahead that searches existing tags and can create new
 * ones inline. Mirrors the Styles collection.
 */
export const Tags: CollectionConfig = {
  slug: 'tags',
  access: {
    read: () => true,
    create: beerManagerAccess,
    update: beerManagerAccess,
    delete: adminAccess,
  },
  admin: {
    hidden: false,
    useAsTitle: 'name',
    defaultColumns: ['name'],
    pagination: {
      defaultLimit: 100,
    },
    group: 'Beer Catalog',
  },
  fields: [
    {
      name: 'name',
      label: 'Tag name',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description:
          'Reusable label, e.g. Seasonal or Award Winner. Each beer selects one tag; renaming updates linked labels.',
      },
    },
  ],
  labels: { singular: 'Beer Tag', plural: 'Beer Tags' },
  defaultSort: 'name',
}
