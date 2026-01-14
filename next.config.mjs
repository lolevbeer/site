import { withPayload } from '@payloadcms/next/withPayload'
import { withSentryConfig } from '@sentry/nextjs'
import bundleAnalyzer from '@next/bundle-analyzer'

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  // trailingSlash: true, // Disabled: causes POST body loss on redirects for Payload API

  // Add caching headers for media files to reduce blob transfer
  async headers() {
    return [
      {
        source: '/api/media/file/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable', // 1 year, immutable (filenames are unique)
          },
        ],
      },
    ]
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  typescript: {
    // Skip type checking during build (run separately in CI if needed)
    ignoreBuildErrors: true,
  },

  env: {
    NEXT_PUBLIC_SERVER_URL: process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL || '',
  },

  images: {
    formats: ['image/avif', 'image/webp'],
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
    removeConsole: process.env.NODE_ENV === 'production',
  },

  experimental: {
    scrollRestoration: true,
    webpackBuildWorker: true,
    // Parallelize static page generation
    parallelServerBuildTraces: true,
    parallelServerCompiles: true,
  },

  // Optimize module transpilation
  transpilePackages: ['@payloadcms/richtext-lexical'],

  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    // Add SVG support
    webpackConfig.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack']
    })

    // Enable filesystem caching for faster rebuilds
    webpackConfig.cache = {
      type: 'filesystem',
      allowCollectingMemory: true,
    }

    return webpackConfig
  },
}

const payloadConfig = withPayload(nextConfig, {
  devBundleServerPackages: false,
})

const analyzedConfig = withBundleAnalyzer(payloadConfig)

export default withSentryConfig(analyzedConfig, {
  // Suppresses source map uploading logs during build
  silent: true,
  org: "lolev-beer",
  project: "javascript-nextjs",

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
