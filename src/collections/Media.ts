import type { CollectionConfig, Access } from 'payload'
import { adminAccess } from '@/src/access/roles'
import { LABEL_VIDEO_MIME } from '@/lib/utils/media-utils'

const isLoggedIn: Access = ({ req: { user } }) => {
  return Boolean(user)
}

export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    hidden: true,
    hideAPIURL: true,
  },
  access: {
    read: () => true,
    create: isLoggedIn,
    update: adminAccess,
    delete: adminAccess,
  },
  upload: {
    staticDir: 'public/uploads',
    // LABEL_VIDEO_MIME: generated can-label sweep loops (LabelTextureGenerator).
    // Sharp/imageSizes only run on images, so videos pass through untouched.
    mimeTypes: ['image/png', 'image/jpg', 'image/jpeg', 'image/webp', LABEL_VIDEO_MIME],
    disableLocalStorage: !!process.env.BLOB_READ_WRITE_TOKEN,
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
