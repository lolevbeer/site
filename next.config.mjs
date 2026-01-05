import { withPayload } from '@payloadcms/next/withPayload'
import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,

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

export default withSentryConfig(payloadConfig, {
  // Suppresses source map uploading logs during build
  silent: true,
  org: "lolev-beer",
  project: "javascript-nextjs",

  // Upload source maps for better stack traces
  widenClientFileUpload: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Hide source maps from browser devtools in production
  hideSourceMaps: true,
})
