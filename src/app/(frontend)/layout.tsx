import { Suspense, type ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'
import { Poppins } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { MotionConfig } from 'framer-motion'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { LocationProvider } from '@/components/location/location-provider'
import { ThemeProvider } from 'next-themes'
import { ConditionalLayout } from '@/components/layout/conditional-layout'
import { FooterGate } from '@/components/layout/footer-gate'
import { Toaster } from '@/components/ui/sonner'
import { ErrorBoundary } from '@/components/error-boundary'
import { SkipNav } from '@/components/ui/skip-nav'
import { GoogleAnalytics } from '@/components/analytics/google-analytics'
import { AuthProvider } from '@/lib/hooks/use-auth'
import { Footer } from '@/components/layout/footer'
import { FooterTaprooms } from '@/components/layout/footer-taprooms'
import { SiteJsonLd } from '@/components/seo/site-json-ld'
import { MotionHydrationSentinel } from '@/components/motion/blur-fade'
import { getAllLocations } from '@/lib/utils/payload-api'
import { getWeeklyHoursForLocations } from '@/lib/utils/homepage-data'
import { getBaseUrl } from '@/lib/utils/get-base-url'
import { DEFAULT_TITLE_TEMPLATE, locationKeywords, trim } from '@/lib/utils/seo'
import { getSiteSeo, siteDefaults } from '@/lib/utils/site-seo'
import { defaultOgImages } from '@/lib/seo/resolve-metadata'
import './globals.css'

/**
 * Fetches the footer's per-location weekly hours and renders it into the
 * footer slot. Rendered inside a `<Suspense>` boundary so the shell can
 * stream before the hours resolve. Takes `locations` from the shell rather
 * than re-fetching them, so this is one query, not two.
 */
async function FooterHours({
  locations,
}: {
  locations: Awaited<ReturnType<typeof getAllLocations>>
}): Promise<ReactNode> {
  return (
    <Footer
      taprooms={
        <FooterTaprooms
          locations={locations}
          weeklyHours={await getWeeklyHoursForLocations(locations)}
        />
      }
    />
  )
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
  // No maximumScale — allow pinch-zoom (WCAG 2.2 SC 1.4.4).
  // Browser chrome follows the OS scheme, not the site's theme toggle; values
  // match --color-background in globals.css.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
}

export async function generateMetadata(): Promise<Metadata> {
  const [locations, siteSeo] = await Promise.all([getAllLocations(), getSiteSeo()])
  // Site defaults only. Home's own overrides are applied in page.tsx so they can't leak to other routes.
  const { title: defaultTitle, description } = siteDefaults(siteSeo, locations)
  const titleTemplate = trim(siteSeo.titleTemplate) ?? DEFAULT_TITLE_TEMPLATE

  return {
    title: {
      default: defaultTitle,
      template: titleTemplate,
    },
    description,
    keywords: [
      'craft beer',
      'brewery',
      'Pittsburgh',
      'local beer',
      'IPA',
      'stout',
      'ale',
      ...(siteSeo.keywords?.filter(Boolean) ?? []),
      ...locationKeywords(locations),
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
      title: defaultTitle,
      description,
      siteName: 'Lolev Beer',
      images: defaultOgImages(siteSeo.ogImage),
    },
    twitter: {
      card: 'summary_large_image',
      site: trim(siteSeo.twitterSite) ?? '@lolevbeer',
      creator: trim(siteSeo.twitterCreator) ?? '@lolevbeer',
    },
    // Site-wide default; Home's noIndex is applied in page.tsx.
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
}

export default async function AppLayout({
  children,
}: Readonly<{
  children: ReactNode
}>): Promise<ReactNode> {
  // Locations feed LocationProvider (used throughout the app), so this fetch
  // stays in the shell. Weekly hours are footer-only and are fetched inside
  // <FooterHours>, suspended below, so they don't block the initial paint.
  const locations = await getAllLocations()

  return (
    // globals.css sets `scroll-behavior: smooth`, and as of Next 16 the router no
    // longer overrides it during navigation. Without this attribute, route changes
    // animate a slow scroll to the top instead of jumping instantly.
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        {/* Favicons */}
        <link rel="icon" href="/favicons/favicon-16x16.png" type="image/png" sizes="16x16" />
        <link rel="icon" href="/favicons/favicon-32x32.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/favicons/apple-touch-icon.png" />
        <link rel="manifest" href="/favicons/site.webmanifest" />

        {/* PWA Meta Tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Lolev" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* Resource Hints for Performance */}
        <link rel="preconnect" href="https://api.mapbox.com" />
        <link rel="dns-prefetch" href="https://api.mapbox.com" />

        {/* RSS Feed Autodiscovery */}
        <link
          rel="alternate"
          type="application/rss+xml"
          title="Lolev Beer RSS Feed"
          href="/feed.xml"
        />
      </head>
      <body className={`${poppins.variable} antialiased min-h-screen flex flex-col font-poppins`}>
        <SiteJsonLd locations={locations} />
        <GoogleAnalytics />
        <div className="flex min-h-0 flex-1 flex-col">
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
              <NuqsAdapter>
                <LocationProvider locations={locations}>
                  <AuthProvider>
                    <MotionHydrationSentinel />
                    <SkipNav />
                    {/* Framer animations honor prefers-reduced-motion site-wide. */}
                    <MotionConfig reducedMotion="user">
                      <ConditionalLayout>{children}</ConditionalLayout>
                    </MotionConfig>
                    <Toaster />
                    <Analytics />
                  </AuthProvider>
                </LocationProvider>
              </NuqsAdapter>
            </ThemeProvider>
          </ErrorBoundary>
        </div>
        {/* Outside LocationProvider so the taproom text is in the HTML shell. */}
        <FooterGate>
          <Suspense fallback={<Footer taprooms={<FooterTaprooms locations={locations} />} />}>
            <FooterHours locations={locations} />
          </Suspense>
        </FooterGate>
      </body>
    </html>
  )
}
