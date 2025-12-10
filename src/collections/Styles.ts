import type { CollectionConfig, Access } from 'payload'

const isAdminOrEditor: Access = ({ req: { user } }) => {
  return user?.role === 'admin' || user?.role === 'editor'
}

export const Styles: CollectionConfig = {
  slug: 'styles',
  access: {
    read: () => true,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
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
