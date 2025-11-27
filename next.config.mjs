import { withPayload } from '@payloadcms/next/withPayload'

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
    NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000',
  },

  images: {
    formats: ['image/avif', 'image/webp'],
  },

  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  experimental: {
    scrollRestoration: true,
    // Optimize webpack caching
    webpackBuildWorker: true,
  },

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

export default withPayload(nextConfig, {
  devBundleServerPackages: false,
})
