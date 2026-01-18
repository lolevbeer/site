import React from 'react'
import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Poppins } from 'next/font/google'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { LocationProvider } from '@/components/location/location-provider'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { AutoThemeSwitcher } from '@/components/providers/auto-theme-switcher'
import { ConditionalLayout } from '@/components/layout/conditional-layout'
import { Toaster } from '@/components/ui/sonner'
import { ErrorBoundary } from '@/components/error-boundary'
import { SkipNav } from '@/components/ui/skip-nav'
import { GoogleAnalytics } from '@/components/analytics/google-analytics'
import { PageViewTracker } from '@/components/analytics/page-view-tracker'
import { AuthProvider } from '@/lib/hooks/use-auth'
import { getAllLocations } from '@/lib/utils/payload-api'
import { getWeeklyHoursForLocations } from '@/lib/utils/homepage-data'
import './globals.css'

/**
 * Get the base URL for metadata.
 * Priority: NEXT_PUBLIC_SITE_URL > VERCEL_PROJECT_PRODUCTION_URL > VERCEL_URL > fallback
 */
function getBaseUrl(): string {
  // Explicit site URL (set in production)
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }
  // Vercel production URL (e.g., lolev.beer if custom domain configured)
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  // Vercel preview/branch URL (auto-generated)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  // Local development fallback
  return 'http://localhost:3000'
}

const poppins = Poppins({
  weight: ['400', '600', '700'],
  variable: '--font-poppins',
  subsets: ['latin'],
  display: 'swap',
  preload: true,
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: {
    default: 'Lolev Beer - Craft Brewery in Pittsburgh',
    template: '%s | Lolev Beer',
  },
  description:
    'Experience exceptional craft beer at Lolev Beer with locations in Lawrenceville and Zelienople. Fresh brews, local food, and community events.',
  keywords: [
    'craft beer',
    'brewery',
    'Pittsburgh',
    'Lawrenceville',
    'Zelienople',
    'local beer',
    'IPA',
    'stout',
    'ale',
  ],
  authors: [{ name: 'Lolev Beer' }],
  creator: 'Lolev Beer',
  publisher: 'Lolev Beer',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(getBaseUrl()),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: getBaseUrl(),
    title: 'Lolev Beer - Craft Beer in Pittsburgh',
    description:
      'Experience exceptional craft beer at Lolev Beer with locations in Lawrenceville and Zelienople. Fresh brews, local food, and community events.',
    siteName: 'Lolev Beer',
    images: [
      {
        url: '/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Lolev Beer - Craft Beer',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lolev Beer - Craft Beer in Pittsburgh',
    description:
      'Experience exceptional craft beer at Lolev Beer with locations in Lawrenceville and Zelienople. Fresh brews, local food, and community events.',
    images: ['/images/og-image.png'],
    creator: '@lolevbeer',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
}

export default async function AppLayout({
  children,
}: Readonly<{
  children: ReactNode
}>): Promise<React.ReactElement> {
  // Fetch locations and weekly hours for footer
  const locations = await getAllLocations()
  const weeklyHours = await getWeeklyHoursForLocations(locations)

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Favicons */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicons/favicon-16x16.png" type="image/png" sizes="16x16" />
        <link rel="icon" href="/favicons/favicon-32x32.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/favicons/apple-touch-icon.png" />
        <link rel="manifest" href="/favicons/site.webmanifest" />

        {/* PWA Meta Tags */}
        <meta name="theme-color" content="#8B5A3C" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="LoL Brewing" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* Resource Hints for Performance */}
        <link rel="preconnect" href="https://api.mapbox.com" />
        <link rel="dns-prefetch" href="https://api.mapbox.com" />

        {/* RSS Feed Autodiscovery */}
        <link rel="alternate" type="application/rss+xml" title="Lolev Beer RSS Feed" href="/feed.xml" />
      </head>
      <body className={`${poppins.variable} antialiased min-h-screen flex flex-col font-poppins`}>
        <GoogleAnalytics />
        <ErrorBoundary>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            enableColorScheme={false}
            disableTransitionOnChange
            themes={['light', 'dark']}
            storageKey="lolev-theme"
          >
            <AutoThemeSwitcher />
            <NuqsAdapter>
              <LocationProvider locations={locations}>
                <AuthProvider>
                  <PageViewTracker />
                  <SkipNav />
                  <ConditionalLayout weeklyHours={weeklyHours}>{children}</ConditionalLayout>
                  <Toaster />
                </AuthProvider>
              </LocationProvider>
            </NuqsAdapter>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
