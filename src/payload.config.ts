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
import { FoodVendors } from './collections/FoodVendors'
import { Locations } from './collections/Locations'
import { HolidayHours } from './collections/HolidayHours'
import { Menus } from './collections/Menus'
import { Distributors } from './collections/Distributors'
import { Products } from './collections/Products'
import { ComingSoon } from './globals/ComingSoon'
import { RecurringFood } from './globals/RecurringFood'
import { SiteContent } from './globals/SiteContent'
import { syncGoogleSheets } from './endpoints/sync-google-sheets'
import { importFoodVendorsCSV } from './endpoints/import-food-vendors-csv'
import { importDistributors } from './endpoints/import-distributors'
import { importLakeBeverageCSV } from './endpoints/import-lake-beverage-csv'
import { updateDistributorUrls } from './endpoints/update-distributor-urls'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Allowed origins for CORS and CSRF
const allowedOrigins = [
  'https://lolev.beer',
  'https://www.lolev.beer',
  // Vercel preview deployments
  ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  ...(process.env.VERCEL_PROJECT_PRODUCTION_URL ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`] : []),
  // Local development
  ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : []),
]

export default buildConfig({
  // Empty serverURL = relative URLs, works on any domain (preview URLs, custom domains, etc.)
  serverURL: '',
  cors: allowedOrigins,
  csrf: allowedOrigins,
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
  collections: [Users, Media, Styles, Beers, Products, Events, Food, FoodVendors, Locations, HolidayHours, Menus, Distributors],
  globals: [ComingSoon, RecurringFood, SiteContent],
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
    {
      path: '/import-food-vendors-csv',
      method: 'post',
      handler: importFoodVendorsCSV,
    },
    {
      path: '/import-distributors',
      method: 'post',
      handler: importDistributors,
    },
    {
      path: '/import-lake-beverage-csv',
      method: 'post',
      handler: importLakeBeverageCSV,
    },
    {
      path: '/update-distributor-urls',
      method: 'post',
      handler: updateDistributorUrls,
    },
  ],
})
