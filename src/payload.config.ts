import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { revalidationPlugin } from './plugins/revalidation-plugin'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Styles } from './collections/Styles'
import { Beers } from './collections/Beers'
import { Events } from './collections/Events'
import { Food } from './collections/Food'
import { Locations } from './collections/Locations'
import { HolidayHours } from './collections/HolidayHours'
import { Menus } from './collections/Menus'
import { Distributors } from './collections/Distributors'
import { ComingSoon } from './globals/ComingSoon'
import { SiteContent } from './globals/SiteContent'
import { syncGoogleSheets } from './endpoints/sync-google-sheets'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  // Empty serverURL means Payload uses relative URLs - works on any port
  serverURL: process.env.NEXT_PUBLIC_APP_URL || '',
  cors: '*', // Allow all origins in development, tighten in production if needed
  csrf: [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  ].filter(Boolean) as string[],
  routes: {
    api: '/api',
    admin: '/admin',
    graphQL: '/api/graphql',
    graphQLPlayground: '/api/graphql-playground',
  },
  cookiePrefix: 'payload',
  admin: {
    user: Users.slug,
    autoLogin: process.env.NODE_ENV === 'development' ? {
      email: 'dev@payloadcms.com',
      password: 'test',
      prefillOnly: true,
    } : false,
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
  collections: [Users, Media, Styles, Beers, Events, Food, Locations, HolidayHours, Menus, Distributors],
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
    revalidationPlugin,
    vercelBlobStorage({
      collections: {
        media: true,
      },
      token: process.env.BLOB_READ_WRITE_TOKEN || '',
    }),
  ],
  endpoints: [
    {
      path: '/sync-google-sheets',
      method: 'post',
      handler: syncGoogleSheets,
    },
  ],
})
