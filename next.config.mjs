import { withPayload } from '@payloadcms/next/withPayload'
import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // localhost and 127.0.0.1 are different origins; Next blocks /_next assets
  // across that pair unless listed here. Dev-only — ignored in production.
  allowedDevOrigins: ['127.0.0.1'],

  async redirects() {
    // Media is served straight from Blob, so Payload's /api/media/file proxy
    // 500s; send old links there. Base URL built as @payloadcms/storage-vercel-blob
    // does, at build time. No token (local dev): Payload serves uploads itself.
    // 307 so browsers don't pin the host.
    const storeId = process.env.BLOB_READ_WRITE_TOKEN?.match(
      /^vercel_blob_rw_([a-z\d]+)_[a-z\d]+$/i,
    )?.[1]?.toLowerCase()
    if (!storeId) return []
    const blobBaseUrl =
      process.env.STORAGE_VERCEL_BLOB_BASE_URL ||
      `https://${storeId}.public.blob.vercel-storage.com`
    return [
      {
        source: '/api/media/file/:path*',
        destination: `${blobBaseUrl}/:path*`,
        permanent: false,
      },
    ]
  },

  env: {
    NEXT_PUBLIC_SERVER_URL: process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL || '',
    NEXT_PUBLIC_DEPLOY_ID: process.env.VERCEL_GIT_COMMIT_SHA || `local-${Date.now()}`,
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    // Next 16 defaults this to [75] and coerces anything else to the nearest
    // allowed value; the hero requests 70. Listing both keeps that request
    // honoured instead of silently upscaling it.
    qualities: [70, 75],
    // Every url x width x format is a billed transform, and Next's default TTL redoes
    // them every 4 hours.
    // ponytail: a Blob file replaced under the same name shows the old image for up to 31 days.
    minimumCacheTTL: 2_678_400,
    // Next's default is 8 widths. 2560 still covers full-bleed images on retina laptops.
    deviceSizes: [640, 828, 1200, 1920, 2560],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: '*.lolev.beer',
      },
      {
        protocol: 'https',
        hostname: 'images.untp.beer',
      },
    ],
  },

  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },

  experimental: {
    // ponytail: barrel tree-shaking to cut unused JS in shared chunks.
    // Ceiling: if a chunk stays bloated, run @next/bundle-analyzer and split by hand.
    optimizePackageImports: [
      'framer-motion',
      'embla-carousel-react',
      '@hugeicons/react',
      '@hugeicons/core-free-icons',
      'date-fns-tz',
    ],
  },

  // Optimize module transpilation
  transpilePackages: ['@payloadcms/richtext-lexical'],
}

const CLIENT_HINT_KEYS = new Set(['Accept-CH', 'Vary', 'Critical-CH'])

/**
 * withPayload adds Accept-CH / Vary / Critical-CH (Sec-CH-Prefers-Color-Scheme)
 * to every path for the admin theme. Critical-CH makes Chromium retry the first
 * navigation on public pages, so move those three headers to /admin/:path* and
 * leave everything else (X-Powered-By) where it was.
 */
export function scopeClientHints(rules) {
  return rules.flatMap((rule) => {
    const hints = rule.headers.filter((h) => CLIENT_HINT_KEYS.has(h.key))
    if (rule.source !== '/:path*' || hints.length === 0) return [rule]
    const rest = rule.headers.filter((h) => !CLIENT_HINT_KEYS.has(h.key))
    return [
      { ...rule, headers: rest },
      { source: '/admin/:path*', headers: hints },
    ]
  })
}

const ABLY = ['*.ably.net', '*.ably.io', '*.ably-realtime.com']
const GTAG = 'https://www.googletagmanager.com'
const GOOGLE_ANALYTICS = [GTAG, 'https://*.google-analytics.com', 'https://*.analytics.google.com']
const BLOB = 'https://*.public.blob.vercel-storage.com'

/**
 * Report-only CSP (#259): logs violations, blocks nothing. Built from what the
 * site loads: GA, Mapbox, Ably (kiosk boards), Sentry, Blob images.
 * ponytail: script-src keeps 'unsafe-inline' because Next's inline scripts would
 * need per-request nonces, which force dynamic rendering and drop ISR. The
 * policy still limits where data can be sent, plugins, <base> and framing.
 * Production builds send reports to Sentry's security endpoint, built from the
 * public DSN; previews only log to the console.
 */
export function cspReportOnly() {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' ${GTAG}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${BLOB} https://images.untp.beer https://*.lolev.beer https://api.mapbox.com ${GOOGLE_ANALYTICS.join(' ')}`,
    "font-src 'self' data:",
    [
      "connect-src 'self'",
      BLOB,
      'https://api.mapbox.com https://events.mapbox.com',
      ...ABLY.flatMap((host) => [`https://${host}`, `wss://${host}`]),
      ...GOOGLE_ANALYTICS,
      'https://*.ingest.sentry.io https://*.ingest.us.sentry.io',
    ].join(' '),
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ]
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (dsn && process.env.VERCEL_ENV === 'production') {
    const { username, host, pathname } = new URL(dsn)
    directives.push(`report-uri https://${host}/api${pathname}/security/?sentry_key=${username}`)
  }
  return directives.join('; ')
}

const payloadConfig = withPayload(nextConfig, {
  devBundleServerPackages: false,
})
const config = {
  ...payloadConfig,
  headers: async () => [
    ...scopeClientHints(await payloadConfig.headers()),
    {
      source: '/:path*',
      headers: [{ key: 'Content-Security-Policy-Report-Only', value: cspReportOnly() }],
    },
  ],
}

export default withSentryConfig(config, {
  // Suppresses source map uploading logs during build
  silent: true,
  org: 'lolev-beer',
  project: 'javascript-nextjs',

  // Upload source maps for better stack traces
  widenClientFileUpload: true,

  // Hide source maps from browser devtools in production
  hideSourceMaps: true,

  // Tree-shake Sentry debug logging to reduce bundle size
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
  },

  // Disable automatic instrumentation to avoid webpack conflicts
  webpack: {
    autoInstrumentServerFunctions: false,
    autoInstrumentMiddleware: false,
    autoInstrumentAppDirectory: false,
  },
})
