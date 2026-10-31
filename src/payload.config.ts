import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { resendAdapter } from '@payloadcms/email-resend'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig, type CollectionConfig, type WidgetInstance } from 'payload'
import { fileURLToPath } from 'url'
import { sharpTransformer } from '@payloadcms/transformer-sharp'
import { revalidationPlugin } from './plugins/revalidation-plugin'

import { Users } from './collections/Users'
import { Media, mediaSharp } from './collections/Media'
import { Styles } from './collections/Styles'
import { Tags } from './collections/Tags'
import { Beers } from './collections/Beers'
import { BeerReviews } from './collections/BeerReviews'
import { Events } from './collections/Events'
import { DonationRequests } from './collections/DonationRequests'
import { EventInquiries } from './collections/EventInquiries'
import { Jobs } from './collections/Jobs'
import { JobApplications } from './collections/JobApplications'
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
import { SiteSeo } from './globals/SiteSeo'
import { importDistributors } from './endpoints/import-distributors'
import { importDistributorsCsv } from './endpoints/import-distributors-csv'
import { updateDistributorUrls } from './endpoints/update-distributor-urls'
import { recalculateBeerPrices } from './endpoints/recalculate-beer-prices'
import { adminAccess, hasRole } from './access/roles'
import { defaultDashboardLayout } from './admin/dashboard-layout'
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

// Validate server-only values before passing them into Payload or its adapters.
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

/**
 * Payload 3 hid each document's "API" tab with `admin.hideAPIURL: true` on every
 * collection. Payload 4 dropped that option, so the tab is hidden here instead.
 * (Typing /api after a document URL still renders it; it shows only what the
 * REST API already returns to that user.)
 */
function hideApiTab(collection: CollectionConfig): CollectionConfig {
  const components = collection.admin?.components
  // Never true today. A collection that adds its own edit views is returned as-is
  // and keeps its API tab, so hide the tab in that collection's `edit` instead.
  // `api` can't be merged in here: Payload's EditConfig union types it `never`
  // alongside a `root` view.
  if (components?.views?.edit) return collection
  return {
    ...collection,
    admin: {
      ...collection.admin,
      components: {
        ...components,
        views: {
          ...components?.views,
          edit: { api: { tab: { condition: () => false } } },
        },
      },
    },
  }
}

export default buildConfig({
  // serverURL, cookiePrefix, and the api/admin routes use Payload's defaults
  // ('' = relative URLs on any domain; 'payload'; '/api'; '/admin').
  cors: allowedOrigins,
  csrf: allowedOrigins,
  routes: {
    // GraphQL lives under /api here; Payload's default is /graphql.
    graphQL: '/api/graphql',
    graphQLPlayground: '/api/graphql-playground',
  },
  // Payload 4 lowered the default query depth to 1; keep v3's 2 until each
  // query that omits `depth` is audited.
  defaultDepth: 2,
  jobs: {
    access: {
      cancel: ({ req }) => hasRole(req.user, 'admin'),
      queue: ({ req }) => hasRole(req.user, 'admin'),
      run: ({ req }) => hasRole(req.user, 'admin'),
    },
    deleteJobOnComplete: false,
    processingOrder: 'createdAt',
    tasks: [syncUntappdRatingsTask],
    jobsCollectionOverrides: ({ defaultJobsCollection }) =>
      hideApiTab({
        ...defaultJobsCollection,
        labels: { singular: 'Background Job', plural: 'Background Jobs' },
        admin: {
          ...defaultJobsCollection.admin,
          group: 'Administration',
          hidden: false,
        },
        // Payload 4 denies all job CRUD by default; open read/delete to admins.
        access: {
          ...defaultJobsCollection.access,
          read: adminAccess,
          delete: adminAccess,
        },
        fields: [
          ...defaultJobsCollection.fields,
          // Rollback safety: Payload 3 claims only jobs with `processing: false`, and
          // Payload 4 dropped the field (it never reads it). This static default makes
          // the mongoose model stamp it on every job Payload 4 creates. Not indexed:
          // migration 20260927_020000 dropped Payload 3's processing_1.
          { name: 'processing', type: 'checkbox', defaultValue: false, admin: { hidden: true } },
        ],
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
    dashboard: {
      widgets: [
        {
          slug: 'schedule-heatmap',
          label: 'Schedule heatmap',
          Component: '@/src/components/admin/ScheduleHeatmap#ScheduleHeatmap',
          minWidth: 'medium',
          // One instance per location; add more from the dashboard and pick one.
          fields: [{ name: 'location', type: 'relationship', relationTo: 'locations' }],
        },
        {
          slug: 'needs-attention',
          label: 'Needs attention',
          Component: '@/src/components/admin/NeedsAttentionWidget#NeedsAttentionWidget',
          minWidth: 'medium',
          fields: [
            {
              name: 'location',
              type: 'relationship',
              relationTo: 'locations',
              admin: {
                description:
                  'Leave empty for every location you can act on; pick one to pin this widget to it.',
              },
            },
          ],
        },
        {
          slug: 'inbox',
          label: 'Inbox',
          Component: '@/src/components/admin/InboxWidget#InboxWidget',
          minWidth: 'medium',
          fields: [
            {
              name: 'kind',
              label: 'Show',
              type: 'select',
              defaultValue: 'all',
              options: [
                { label: 'Everything', value: 'all' },
                { label: 'Event inquiries', value: 'events' },
                { label: 'Donation requests', value: 'donations' },
                { label: 'Job applications', value: 'jobs' },
              ],
            },
          ],
        },
        {
          // Kept so dashboards saved with the old Donation requests widget still render.
          slug: 'donation-requests',
          label: 'Donation requests',
          Component: '@/src/components/admin/InboxWidget#DonationRequestsInboxWidget',
        },
        {
          slug: 'menu-target-history',
          label: 'Menu tracking',
          Component: '@/src/components/admin/MenuTargetHistory#MenuTargetHistory',
          fields: [
            {
              name: 'view',
              type: 'select',
              defaultValue: 'cards',
              options: [
                { label: 'Cards', value: 'cards' },
                { label: 'History chart', value: 'chart' },
              ],
            },
          ],
        },
        {
          slug: 'menu-items',
          label: 'Menu items',
          Component: '@/src/components/admin/MenuItems#MenuItems',
          fields: [
            {
              name: 'menu',
              type: 'relationship',
              relationTo: 'menus',
              required: true,
              admin: {
                description: 'Add one widget per menu, or use multiple views of the same menu.',
              },
            },
            {
              name: 'itemKind',
              label: 'Items to show',
              type: 'select',
              defaultValue: 'all',
              options: [
                { label: 'All menu items', value: 'all' },
                { label: 'Beers only', value: 'beers' },
                { label: 'Products only', value: 'products' },
              ],
            },
          ],
        },
      ],
      // Per role (src/admin/dashboard-layout.ts), from locations and menus read as the
      // signed-in user. Applies only to people without a saved dashboard.
      defaultLayout: async ({ req }) => {
        const [locations, menus] = await Promise.all([
          req.payload.find({
            collection: 'locations',
            depth: 0,
            pagination: false,
            select: { name: true },
            sort: 'name',
            overrideAccess: false,
            req,
          }),
          req.payload.find({
            collection: 'menus',
            depth: 0,
            pagination: false,
            select: { location: true },
            sort: 'type',
            overrideAccess: false,
            req,
          }),
        ])
        return defaultDashboardLayout({
          user: req.user,
          locations: locations.docs,
          menus: menus.docs,
        }) as WidgetInstance[]
      },
    },
    // Payload 4's Vercel Blob adapter registers its client upload handler only
    // when a blob token is set; declaring it here keeps importMap.js identical
    // with or without one (Payload 3 always registered it).
    dependencies: {
      '@payloadcms/storage-vercel-blob/client#VercelBlobClientUploadHandler': {
        type: 'component',
        path: '@payloadcms/storage-vercel-blob/client#VercelBlobClientUploadHandler',
      },
    },
    components: {
      graphics: {
        Logo: '@/src/components/AdminLogo#AdminLogo',
        Icon: '@/src/components/AdminLogo#AdminIcon',
      },
      actions: [],
      afterNavLinks: ['@/src/components/SyncNavLink#SyncNavLink'],
      views: {
        sync: {
          Component: '@/src/components/SyncView#SyncView',
          path: '/sync',
          meta: {
            title: 'Sync',
          },
        },
      },
    },
  },
  // Payload 4 keeps version history for every collection and global unless told
  // not to. Only Beers and Menus want history; they set their own `versions`.
  // Payload 4 beta also adds readable `createdBy`/`updatedBy` user stamps to
  // everything by default; off here so public docs don't expose staff IDs.
  // Beers and Menus keep their own signed-in-only `updatedBy` (updatedByField).
  collections: [
    // Beer Catalog
    Beers,
    BeerReviews,
    Styles,
    Tags,
    // Taproom Operations
    Menus,
    Products,
    Locations,
    HolidayHours,
    // Food & Events
    Events,
    DonationRequests,
    EventInquiries,
    RecurringEvents,
    Food,
    FoodVendors,
    // Hiring
    Jobs,
    JobApplications,
    // Website
    Distributors,
    FAQs,
    // Administration
    Users,
    // System (hidden from nav)
    RecurringFoodSchedules,
    RecurringFoodExclusions,
    Media,
  ].map((collection) => hideApiTab({ versions: false, authorship: false, ...collection })),
  globals: [
    // Beer Catalog
    ComingSoon,
    // Food & Events
    RecurringFood,
    // Website
    SiteContent,
    SiteSeo,
  ].map((global) => ({ versions: false, authorship: false, ...global })),
  editor: lexicalEditor(),
  // Payload 4 beta adds a `payload-llm-instructions` collection on its own
  // default access, outside the role rules in src/access. Off until we use it.
  llmInstructions: false,
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
    // manifest in src/migrations/recovery/ governs partial failures: batch
    // `migrate:down` is prohibited, and recovery requires the recorded
    // migration-specific roll-forward or restore procedure. The manifest is not
    // a sibling of the migration files because `payload migrate` loads every
    // `.ts`/`.js` file in that directory except index and calls `up()`.
    // Disabling Payload's transaction here avoids Atlas's 60-second transaction
    // lifetime limit; it does not make a partial migration safe to rerun without
    // following that manifest.
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
  upload: {
    transformers: [sharpTransformer({ collections: { media: mediaSharp } })],
  },
  // Admin password resets and event-inquiry emails. Without a key (local dev,
  // CI) Payload's console adapter logs them instead. lolev.beer must stay a
  // verified sending domain in Resend.
  email: process.env.RESEND_API_KEY
    ? resendAdapter({
        apiKey: process.env.RESEND_API_KEY,
        defaultFromAddress: 'app@lolev.beer',
        defaultFromName: 'Lolev App',
      })
    : undefined,
  plugins: [revalidationPlugin],
  endpoints: [
    {
      path: '/import-distributors',
      method: 'post',
      handler: importDistributors,
    },
    {
      path: '/import-distributors-csv',
      method: 'post',
      handler: importDistributorsCsv,
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
  ],
  storage: [
    vercelBlobStorage({
      collections: {
        // Public read on Media already; skip the Payload /api/media/file proxy so
        // generated URLs point at *.public.blob.vercel-storage.com (Blob CDN)
        // instead of Fast Origin Transfer through the Next.js origin.
        media: {
          disablePayloadAccessControl: true,
        },
      },
      token: serverEnv.blobReadWriteToken,
    }),
  ],
})
