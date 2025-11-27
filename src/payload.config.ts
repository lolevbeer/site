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
import { HolidayHours } from './collections/HolidayHours'
import { Menus } from './collections/Menus'
import { ComingSoon } from './globals/ComingSoon'
import { SiteContent } from './globals/SiteContent'
import { syncGoogleSheets } from './endpoints/sync-google-sheets'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  serverURL: process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'),
  cors: [
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  ].filter(Boolean),
  csrf: [
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  ].filter(Boolean),
  routes: {
    api: '/api',
    admin: '/admin',
    graphQL: '/api/graphql',
    graphQLPlayground: '/api/graphql-playground',
  },
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      graphics: {
        Logo: './components/AdminLogo#AdminLogo',
        Icon: './components/AdminLogo#AdminIcon',
      },
      providers: ['./components/AdminNavLink#AdminNavLink'],
      actions: ['./components/ViewSiteLink#ViewSiteLink'],
      afterNavLinks: ['./components/SyncNavLink#SyncNavLink'],
      views: {
        syncGoogleSheets: {
          Component: './components/SyncView#SyncView',
          path: '/sync',
          meta: {
            title: 'Sync Google Sheets',
          },
        },
      },
    },
  },
  collections: [Users, Media, Styles, Beers, Events, Food, Locations, HolidayHours, Menus],
  globals: [ComingSoon, SiteContent],
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
