import type { CollectionConfig } from 'payload'
import { adminAccess, beerManagerAccess } from '@/src/access/roles'

export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'price', 'category'],
  },
  access: {
    read: () => true,
    create: beerManagerAccess,
    update: beerManagerAccess,
    delete: adminAccess,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'options',
      type: 'text',
      hasMany: true,
      admin: {
        description: 'Press "Enter" or "Tab" after entering option to add another',
      },
    },
    {
      name: 'abv',
      type: 'number',
      admin: {
        description: 'Alcohol by volume (%)',
        step: 0.1,
      },
    },
    {
      name: 'price',
      type: 'text',
      admin: {
        description: 'Display price (e.g., "$5.00")',
      },
    },
  ],
}
