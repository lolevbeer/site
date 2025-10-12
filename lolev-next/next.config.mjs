/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },

  // Image optimization configuration
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    // Add external domains here if loading images from external sources
    remotePatterns: [
      // Example: { protocol: 'https', hostname: 'example.com' }
    ],
  },

  // Environment variables
  env: {
    NEXT_PUBLIC_APP_ENV: process.env.NODE_ENV || 'development',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://lolev.dev',
  },

  // Build optimization
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Experimental features for performance
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },

  // Note: Static export disabled since we're using custom server.js
  // If you need static export, set: output: 'export' and images.unoptimized: true

  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  generateEtags: true,

  // Webpack configuration
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // SVG handling
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack']
    });

    // Bundle analyzer (only in development)
    if (dev && process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'server',
          openAnalyzer: true,
        })
      );
    }

    return config;
  },

  // TypeScript configuration
  typescript: {
    ignoreBuildErrors: true, // Temporarily disabled to analyze bundle
  },

  // ESLint configuration
  eslint: {
    ignoreDuringBuilds: true, // Temporarily disabled to analyze bundle
  },

  // Logging
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

export default nextConfig;