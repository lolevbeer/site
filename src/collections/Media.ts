import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import type { CollectionConfig } from 'payload'
import type { SharpCollectionConfig } from '@payloadcms/transformer-sharp'
import { adminAccess, authenticatedAccess } from '@/src/access/roles'
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
  hooks: {
    // The main file's URL is public, so strip EXIF (GPS, device) before Payload
    // sees the upload: auto-rotate, then re-encode in the same format without
    // metadata. Runs before upload processing, so Sharp leaves the main file
    // as-is and Payload stores no `-original` copy (see mediaSharp).
    beforeOperation: [
      async ({ operation, req }) => {
        const file = req.file
        if ((operation !== 'create' && operation !== 'update') || !file) return
        if (!file.mimetype.startsWith('image/')) return
        const input = file.tempFilePath ? await readFile(file.tempFilePath) : file.data
        const data = await sharp(input).rotate().toBuffer()
        req.file = { name: file.name, mimetype: file.mimetype, data, size: data.length }
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

/**
 * Sharp settings for Media, registered via `sharpTransformer` in payload.config.
 * Payload 4 moved image processing out of the collection's `upload` config;
 * generated sizes are stored under each doc's `variants` (formerly `sizes`).
 *
 * No main-file `formatOptions`: when Sharp re-encodes the main file, Payload 4
 * also stores the untouched upload as `<name>-original` next to it, at a
 * guessable public Blob URL. EXIF is stripped earlier instead, by Media's
 * beforeOperation hook, so the main file stays in its uploaded format.
 */
export const mediaSharp: SharpCollectionConfig = {
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
