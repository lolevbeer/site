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
import { Tags } from './collections/Tags'
import { Beers } from './collections/Beers'
import { BeerReviews } from './collections/BeerReviews'
import { Events } from './collections/Events'
import { RecurringEvents } from './collections/RecurringEvents'
import { Food } from './collections/Food'
import { FoodVendors } from './collections/FoodVendors'
import { RecurringFoodSchedules } from './collections/RecurringFoodSchedules'
import { RecurringFoodExclusions } from './collections/RecurringFoodExclusions'
import { Locations } from './collections/Locations'
import { HolidayHours } from './collections/HolidayHours'
import { Menus } from './collections/Menus'
import { Distributors } from './collections/Distributors'
import { Products } from './collections/Products'
import { FAQs } from './collections/FAQs'
import { ComingSoon } from './globals/ComingSoon'
import { RecurringFood } from './globals/RecurringFood'
import { SiteContent } from './globals/SiteContent'
import { importDistributors } from './endpoints/import-distributors'
import { importLakeBeverageCSV } from './endpoints/import-lake-beverage-csv'
import { updateDistributorUrls } from './endpoints/update-distributor-urls'
import { recalculateBeerPrices } from './endpoints/recalculate-beer-prices'
import { regeocodeDistributors } from './endpoints/regeocode-distributors'
import { syncUntappdRatings } from './endpoints/sync-untappd-ratings'
import { adminAccess, hasRole } from './access/roles'
import { syncUntappdRatingsTask } from './jobs/sync-untappd-ratings'
import { getLocalDevOrigins } from '../lib/config/payload-origins'
import { readServerEnvironment } from '../lib/config/server-env'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * True when this config is being loaded by `payload migrate` / `migrate:status`
 * rather than to serve requests. See the `transactionOptions` note on the db
 * adapter below for why migrations opt out of transactions.
 */
const isMigrationCommand = process.argv.some(
  (arg) => arg === 'migrate' || arg.startsWith('migrate:'),
)

const serverEnv = readServerEnvironment()

// Allowed origins for CORS and CSRF
const allowedOrigins = [
  'https://lolev.beer',
  'https://www.lolev.beer',
  'https://new.lolev.beer',
  // GitHub Pages site that fetches the beers API cross-origin
  'https://lolevbeer.github.io',
  // Vercel preview deployments
  ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
    : []),
  // Local development
  ...(process.env.NODE_ENV === 'development' ? getLocalDevOrigins(process.env.PORT) : []),
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
  jobs: {
    access: {
      cancel: ({ req }) => hasRole(req.user, 'admin'),
      queue: ({ req }) => hasRole(req.user, 'admin'),
      run: ({ req }) => hasRole(req.user, 'admin'),
    },
    addParentToTaskLog: true,
    deleteJobOnComplete: false,
    depth: 0,
    processingOrder: 'createdAt',
    tasks: [syncUntappdRatingsTask],
    jobsCollectionOverrides: ({ defaultJobsCollection }) => ({
      ...defaultJobsCollection,
      admin: {
        ...defaultJobsCollection.admin,
        group: 'System',
        hidden: false,
        hideAPIURL: true,
      },
      access: {
        read: adminAccess,
        create: () => false,
        update: () => false,
        delete: adminAccess,
      },
    }),
  },
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
        sync: {
          Component: './components/SyncView#SyncView',
          path: '/sync',
          meta: {
            title: 'Sync',
          },
        },
      },
    },
  },
  collections: [
    // Back of House
    Beers,
    BeerReviews,
    Styles,
    Tags,
    // Front of House
    Menus,
    Products,
    // Food & Events
    Events,
    RecurringEvents,
    Food,
    FoodVendors,
    RecurringFoodSchedules,
    RecurringFoodExclusions,
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
  secret: serverEnv.payloadSecret,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({
    url: serverEnv.databaseUri,
    // Payload wraps an entire migration in one MongoDB transaction, but Atlas
    // enforces transactionLifetimeLimitSeconds (60s by default) and kills any
    // that outlive it. The normalization migrations page the whole beer and
    // recurring-food catalogue with a round trip per document, which blows past
    // that on a remote cluster and fails with NoSuchTransaction (code 251) —
    // the writes roll back, so the migration can never finish.
    //
    // Migrations do not all have interchangeable recovery semantics. The recovery
    // manifest governs partial failures: batch `migrate:down` is prohibited, and
    // recovery requires the recorded migration-specific roll-forward or restore
    // procedure. Disabling Payload's transaction here avoids Atlas's 60-second
    // transaction lifetime limit; it does not make a partial migration safe to
    // rerun without following that manifest.
    ...(isMigrationCommand ? { transactionOptions: false as const } : {}),
    // Serverless connection hardening. Each Vercel lambda opens its own Mongoose
    // pool; the MongoDB driver default is maxPoolSize 100. A post-deploy ISR
    // regeneration storm (many cold lambdas booting Payload at once) can then
    // spike well past MongoDB's connection limit and surface as the transient
    // fetch errors that used to poison the route cache (see PR #144). Cap the
    // per-lambda pool small and let idle sockets close so warm-but-quiet
    // instances don't hold connections open.
    // ponytail: maxPoolSize 10 is ample for this low-traffic site; raise it only
    // if a single instance ever needs more concurrent in-flight queries.
    connectOptions: {
      maxPoolSize: 10,
      maxIdleTimeMS: 10000,
      // Bound connection and server selection while the health probe applies its
      // own cancellable timeout to the native MongoDB ping operation.
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
    },
  }),
  sharp,
  plugins: [
    revalidationPlugin,
    vercelBlobStorage({
      collections: {
        media: true,
      },
      token: serverEnv.blobReadWriteToken,
    }),
  ],
  endpoints: [
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
