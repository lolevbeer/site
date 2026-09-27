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
    hidden: true,
    useAsTitle: 'name',
    defaultColumns: ['name'],
    pagination: {
      defaultLimit: 100,
    },
  },
  fields: [
    {
      name: 'name',
      label: 'Name',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Beer style name (e.g., IPA, Stout, Pale Ale)',
      },
    },
  ],
}
