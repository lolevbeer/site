import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    hidden: true,
  },
  access: {
    read: () => true,
  },
  upload: {
    staticDir: 'public/uploads',
    mimeTypes: ['image/png', 'image/jpg', 'image/jpeg', 'image/webp'],
    imageSizes: [
      {
        name: 'card',
        width: 250,
        height: 250,
        position: 'centre',
        crop: 'attention',
        formatOptions: {
          format: 'webp',
        },
      },
    ],
    formatOptions: {
      format: 'webp',
    },
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
