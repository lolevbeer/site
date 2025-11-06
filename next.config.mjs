/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack configuration (for dev mode with next dev --turbo)
  turbopack: {
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },

  // Static export for GitHub Pages
  output: 'export',

  // Enable trailing slashes for GitHub Pages compatibility
  trailingSlash: true,

  // Image optimization configuration
  images: {
    unoptimized: true, // Required for static export
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [32, 48, 64, 96, 128, 256, 384], // Removed 16 (Next.js 16 default change)
    minimumCacheTTL: 60,
    qualities: [75, 85, 90, 100], // Next.js 16 requirement: explicitly define allowed quality values
    // Add external domains here if loading images from external sources
    remotePatterns: [
      // Example: { protocol: 'https', hostname: 'example.com' }
    ],
  },

  // Environment variables
  env: {
    NEXT_PUBLIC_APP_ENV: process.env.NODE_ENV || 'development',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://lolev.beer',
  },

  // Build optimization
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Experimental features for performance
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-accordion',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-slider',
      '@radix-ui/react-switch',
      '@radix-ui/react-toggle',
      '@radix-ui/react-toggle-group',
      '@radix-ui/react-separator',
      '@radix-ui/react-label',
      '@radix-ui/react-slot',
    ],
    scrollRestoration: true,
  },

  // Static export enabled for GitHub Pages deployment
  // The build will generate an 'out/' directory with static HTML files

  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  generateEtags: true,

  // Webpack configuration (for production builds)
  webpack: (config, { dev, isServer }) => {
    // SVG handling with @svgr/webpack (used in production builds)
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack']
    });

    // Bundle analyzer for both dev and production
    if (process.env.ANALYZE === 'true' && !isServer) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
        config.plugins.push(
          new BundleAnalyzerPlugin({
            analyzerMode: dev ? 'server' : 'static',
            reportFilename: './analyze.html',
            openAnalyzer: dev,
          })
        );
      } catch {
        console.warn('webpack-bundle-analyzer not installed, skipping bundle analysis');
      }
    }

    return config;
  },

  // TypeScript configuration
  typescript: {
    ignoreBuildErrors: false, // Enable TypeScript checking during build
  },

  // Logging
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

export default nextConfig;