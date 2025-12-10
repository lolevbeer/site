import type { CollectionConfig, Access } from 'payload'

// Check if user is admin or editor
const isAdminOrEditor: Access = ({ req: { user } }) => {
  return user?.role === 'admin' || user?.role === 'editor'
}

export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    // hidden: true, // Temporarily unhidden to debug upload field issue
  },
  access: {
    read: () => true,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
  upload: {
    staticDir: 'public/uploads',
    mimeTypes: ['image/png', 'image/jpg', 'image/jpeg', 'image/webp'],
    disableLocalStorage: false,
    formatOptions: {
      format: 'png',
    },
    imageSizes: [
      {
        name: 'thumbnail',
        width: 150,
        height: 150,
        position: 'centre',
        crop: 'attention',
        formatOptions: {
          format: 'webp',
        },
      },
      {
        name: 'card',
        width: 500,
        height: 500,
        position: 'centre',
        crop: 'attention',
        formatOptions: {
          format: 'webp',
        },
      },
      {
        name: 'detail',
        width: 1200,
        height: 1200,
        position: 'centre',
        crop: 'attention',
        formatOptions: {
          format: 'webp',
        },
      },
    ],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: {
        description: 'Alternative text for the image (for accessibility)',
      },
    },
  ],
}
