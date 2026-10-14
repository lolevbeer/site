/** Non-beer menu items, with content fields together and display badges secondary. */
import type { CollectionConfig } from 'payload'
import { adminAccess, hasRole } from '@/src/access/roles'
import { OTHER_MENU_CATEGORIES } from '@/lib/config/other-menu'

export const Products: CollectionConfig = {
  slug: 'products',
  labels: { singular: 'Other Menu Item', plural: 'Other Menu Items' },
  admin: {
    group: 'Taproom Operations',
    useAsTitle: 'name',
    defaultColumns: ['name', 'price', 'category'],
    description: 'Other items selectable on menus. Maintain brewery beers in Beer Catalog.',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => hasRole(user, ['admin', 'beer-manager', 'bartender']),
    update: ({ req: { user } }) => hasRole(user, ['admin', 'beer-manager', 'bartender']),
    delete: adminAccess,
  },
  fields: [
    { name: 'name', label: 'Item name', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        {
          name: 'category',
          label: 'Menu category',
          type: 'select',
          options: [...OTHER_MENU_CATEGORIES],
          admin: {
            width: '50%',
            description:
              'Optional grouping on Other Things menus. Uncategorized items remain visible.',
          },
        },
        {
          name: 'price',
          label: 'Display price',
          type: 'text',
          admin: { width: '50%', description: 'Price text shown on menus, e.g. "$5.00".' },
        },
      ],
    },
    { name: 'description', type: 'textarea' },
    {
      name: 'options',
      label: 'Menu options',
      type: 'text',
      hasMany: true,
      admin: { description: 'Choices shown with this item. Press Enter or Tab after each option.' },
    },
    {
      name: 'abv',
      label: 'ABV (%)',
      type: 'number',
      admin: { description: 'Alcohol by volume, if applicable.', step: 0.1 },
    },
    {
      name: 'guestTap',
      label: 'Guest tap',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Product from another brewery. Shows "Guest Tap" badge on menu.',
      },
    },
    {
      name: 'collab',
      label: 'Collaboration',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Collaboration product. Shows "Collab" badge on menu.',
      },
    },
  ],
}
