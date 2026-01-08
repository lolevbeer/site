import type { CollectionConfig } from 'payload'
import { foodManagerAccess, isAdmin } from '@/src/access/roles'

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
    hideAPIURL: true,
    defaultColumns: ['name', 'email', 'phone', 'site'],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'email',
      type: 'email',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'phone',
      type: 'text',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'site',
      type: 'text',
      label: 'Website',
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
    },
  ],
}
