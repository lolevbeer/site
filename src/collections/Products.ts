import type { CollectionConfig } from 'payload'
import { adminAccess, hasRole, isAdmin } from '@/src/access/roles'

export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    group: 'Front of House',
    useAsTitle: 'name',
    hideAPIURL: true,
    defaultColumns: ['name', 'price', 'category'],
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => hasRole(user, ['admin', 'beer-manager', 'bartender']),
    update: ({ req: { user } }) => hasRole(user, ['admin', 'beer-manager', 'bartender']),
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
        position: 'sidebar',
      },
    },
    {
      name: 'abv',
      type: 'number',
      admin: {
        description: 'Alcohol by volume (%)',
        step: 0.1,
        position: 'sidebar',
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
