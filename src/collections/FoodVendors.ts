import type { CollectionConfig } from 'payload'
import { foodManagerAccess } from '@/src/access/roles'

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
    useAsTitle: 'name',
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
    },
    {
      name: 'phone',
      type: 'text',
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
