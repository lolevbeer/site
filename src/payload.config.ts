// storage-adapter-import-placeholder
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Styles } from './collections/Styles'
import { Beers } from './collections/Beers'
import { Events } from './collections/Events'
import { Food } from './collections/Food'
import { Locations } from './collections/Locations'
import { Menus } from './collections/Menus'
import { ComingSoon } from './globals/ComingSoon'
import { syncGoogleSheets } from './endpoints/sync-google-sheets'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Styles, Beers, Events, Food, Locations, Menus],
  cookieOptions: {
    maxAge: 72 * 60 * 60, // 72 hours in seconds
  },
  globals: [ComingSoon],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({
    url: process.env.DATABASE_URI || '',
  }),
  sharp,
  plugins: [
    // storage-adapter-placeholder
  ],
  endpoints: [
    {
      path: '/sync-google-sheets',
      method: 'post',
      handler: syncGoogleSheets,
    },
  ],
})
