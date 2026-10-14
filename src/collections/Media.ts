import type { CollectionConfig } from 'payload'
import type { SharpCollectionConfig } from '@payloadcms/transformer-sharp'
import { adminAccess, adminFieldAccess, authenticatedAccess } from '@/src/access/roles'
import { LABEL_VIDEO_MIME } from '@/lib/utils/media-utils'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    hidden: true,
  },
  access: {
    read: () => true,
    create: authenticatedAccess,
    update: adminAccess,
    delete: adminAccess,
  },
  upload: {
    staticDir: 'public/uploads',
    // LABEL_VIDEO_MIME: generated can-label sweep loops (LabelTextureGenerator).
    // Sharp (configured in mediaSharp below) only runs on images, so videos pass through untouched.
    mimeTypes: ['image/png', 'image/jpg', 'image/jpeg', 'image/webp', LABEL_VIDEO_MIME],
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
    // Payload 4 keeps the untouched upload as `original` whenever Sharp re-encodes
    // it (every image here, via formatOptions). That file still has its EXIF
    // (GPS, device), so only admins read it. Payload merges this into its own
    // `original` group, so only `access` is added here.
    // ponytail: beta.0 has no option to skip storing the original; drop this once one exists.
    {
      name: 'original',
      type: 'group',
      access: { read: adminFieldAccess },
      fields: [],
    },
  ],
}

/**
 * Sharp settings for Media, registered via `sharpTransformer` in payload.config.
 * Payload 4 moved image processing out of the collection's `upload` config;
 * generated sizes are stored under each doc's `variants` (formerly `sizes`).
 */
export const mediaSharp: SharpCollectionConfig = {
  formatOptions: { format: 'png' },
  variants: [
    {
      name: 'thumbnail',
      width: 150,
      height: 150,
      position: 'centre',
      crop: 'attention',
      formatOptions: { format: 'webp' },
    },
    {
      name: 'card',
      width: 500,
      height: 500,
      position: 'centre',
      crop: 'attention',
      formatOptions: { format: 'webp' },
    },
    {
      name: 'detail',
      width: 1200,
      height: 1200,
      position: 'centre',
      crop: 'attention',
      formatOptions: { format: 'webp' },
    },
  ],
}
