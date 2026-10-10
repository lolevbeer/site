import { withPayload } from '@payloadcms/next/withPayload'
import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // localhost and 127.0.0.1 are different origins; Next blocks /_next assets
  // across that pair unless listed here. Dev-only — ignored in production.
  allowedDevOrigins: ['127.0.0.1'],

  async redirects() {
    // Media is served straight from Vercel Blob (disablePayloadAccessControl in
    // payload.config.ts), so Payload's /api/media/file proxy 500s. Send old
    // links to the same filename on the Blob store. The store id comes from the
    // token, parsed the way @payloadcms/storage-vercel-blob does. With no token
    // (local dev) Payload serves public/uploads itself, so no redirect. 307, not
    // 308, so browsers don't pin the host if the store is ever rotated.
    const storeId = process.env.BLOB_READ_WRITE_TOKEN?.match(
      /^vercel_blob_rw_([a-z\d]+)_[a-z\d]+$/i,
    )?.[1]?.toLowerCase()
    if (!storeId) return []
    return [
      {
        source: '/api/media/file/:path*',
        destination: `https://${storeId}.public.blob.vercel-storage.com/:path*`,
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
      ...(rest.length > 0 ? [{ ...rule, headers: rest }] : []),
      { source: '/admin/:path*', headers: hints },
    ]
  })
}

const payloadConfig = withPayload(nextConfig, {
  devBundleServerPackages: false,
})
const payloadHeaders = payloadConfig.headers
payloadConfig.headers = async () => scopeClientHints(await payloadHeaders())

export default withSentryConfig(payloadConfig, {
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
