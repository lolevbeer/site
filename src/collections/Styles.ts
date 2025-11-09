import type { CollectionConfig } from 'payload'

export const Styles: CollectionConfig = {
  slug: 'styles',
  admin: {
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
