import type { CollectionConfig } from 'payload'
import { adminAccess, beerManagerAccess } from '@/src/access/roles'

export const Styles: CollectionConfig = {
  slug: 'styles',
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
      label: 'Style name',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description:
          'Reuse an existing style, e.g. IPA or Stout. Renaming changes the label on linked beers.',
      },
    },
  ],
  labels: { singular: 'Beer Style', plural: 'Beer Styles' },
  defaultSort: 'name',
}
