import type { CollectionConfig } from 'payload'
import { authenticatedFieldAccess, foodManagerAccess } from '@/src/access/roles'

export const FoodVendors: CollectionConfig = {
  slug: 'food-vendors',
  access: {
    read: () => true,
    create: foodManagerAccess,
    update: foodManagerAccess,
    delete: foodManagerAccess,
  },
  labels: {
    singular: 'Food Vendor',
    plural: 'Food Vendors',
  },
  admin: {
    group: 'Food & Events',
    useAsTitle: 'name',
    defaultColumns: ['name', 'site', 'email', 'phone'],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      label: 'Vendor name',
      admin: {
        description: 'Shown on the public food schedule.',
      },
    },
    {
      name: 'site',
      type: 'text',
      label: 'Public website',
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      label: 'Public logo',
    },
    {
      type: 'collapsible',
      label: 'Staff contact details',
      admin: { initCollapsed: true },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'email',
              type: 'email',
              access: {
                read: authenticatedFieldAccess,
              },
              admin: {
                width: '50%',
                description: 'Signed-in staff only.',
              },
              label: 'Staff contact email',
            },
            {
              name: 'phone',
              type: 'text',
              access: {
                read: authenticatedFieldAccess,
              },
              admin: {
                width: '50%',
                description: 'Signed-in staff only.',
              },
              label: 'Staff contact phone',
            },
          ],
        },
      ],
    },
  ],
}
