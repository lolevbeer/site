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
import { FAQs } from './collections/FAQs'
import { ComingSoon } from './globals/ComingSoon'
import { RecurringFood } from './globals/RecurringFood'
import { SiteContent } from './globals/SiteContent'
import { syncGoogleSheets } from './endpoints/sync-google-sheets'
import { importFoodVendorsCSV } from './endpoints/import-food-vendors-csv'
import { importDistributors } from './endpoints/import-distributors'
import { importLakeBeverageCSV } from './endpoints/import-lake-beverage-csv'
import { updateDistributorUrls } from './endpoints/update-distributor-urls'
import { recalculateBeerPrices } from './endpoints/recalculate-beer-prices'
import { regeocodeDistributors } from './endpoints/regeocode-distributors'
import { syncUntappdRatings } from './endpoints/sync-untappd-ratings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Allowed origins for CORS and CSRF
const allowedOrigins = [
  'https://lolev.beer',
  'https://www.lolev.beer',
  'https://new.lolev.beer',
  // Vercel preview deployments
  ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
    : []),
  // Local development
  ...(process.env.NODE_ENV === 'development'
    ? ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002']
    : []),
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
    meta: {
      titleSuffix: '- Lolev Beer',
      description: 'Lolev Beer Admin',
      icons: [
        { rel: 'icon', url: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', url: '/favicons/favicon-16x16.png' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', url: '/favicons/favicon-32x32.png' },
        { rel: 'apple-touch-icon', url: '/favicons/apple-touch-icon.png' },
      ],
    },
    // autoLogin: process.env.NODE_ENV === 'development' ? {
    //   email: 'dev@payloadcms.com',
    //   password: 'test',
    //   prefillOnly: true,
    // } : false,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      graphics: {
        Logo: './components/AdminLogo#AdminLogo',
        Icon: './components/AdminLogo#AdminIcon',
      },
      providers: [
        './components/AdminNavLink#AdminNavLink',
        './components/admin/LinesCleanedAlert#LinesCleanedAlert',
      ],
      actions: [],
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
  collections: [
    // Back of House
    Beers,
    Styles,
    // Front of House
    Menus,
    Products,
    // Food & Events
    Events,
    Food,
    FoodVendors,
    // Settings (last)
    Users,
    Locations,
    HolidayHours,
    Distributors,
    FAQs,
    Media,
  ],
  globals: [
    // Back of House
    ComingSoon,
    // Food & Events
    RecurringFood,
    // Settings (last)
    SiteContent,
  ],
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
    {
      path: '/recalculate-beer-prices',
      method: 'post',
      handler: recalculateBeerPrices,
    },
    {
      path: '/regeocode-distributors',
      method: 'post',
      handler: regeocodeDistributors,
    },
    {
      path: '/sync-untappd-ratings',
      method: 'post',
      handler: syncUntappdRatings,
    },
  ],
})
