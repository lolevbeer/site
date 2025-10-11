import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { LocationProvider } from "@/components/location/location-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Toaster } from "@/components/ui/sonner";

const poppins = Poppins({
  weight: ['300', '400', '500', '600', '700'],
  variable: "--font-poppins",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Lolev Beer - Craft Beer in Pittsburgh",
    template: "%s | Lolev Beer"
  },
  description: "Experience exceptional craft beer at Lolev Beer with locations in Lawrenceville and Zelienople. Fresh brews, local food, and community events.",
  keywords: ["craft beer", "brewery", "Pittsburgh", "Lawrenceville", "Zelienople", "local beer", "IPA", "stout", "ale"],
  authors: [{ name: "Lolev Beer" }],
  creator: "Lolev Beer",
  publisher: "Lolev Beer",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL("https://next.lolev.beer"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://next.lolev.beer",
    title: "Lolev Beer - Craft Beer in Pittsburgh",
    description: "Experience exceptional craft beer at Lolev Beer with locations in Lawrenceville and Zelienople. Fresh brews, local food, and community events.",
    siteName: "Lolev Beer",
    images: [
      {
        url: "/images/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Lolev Beer - Craft Beer",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lolev Beer - Craft Beer in Pittsburgh",
    description: "Experience exceptional craft beer at Lolev Beer with locations in Lawrenceville and Zelienople. Fresh brews, local food, and community events.",
    images: ["/images/og-image.jpg"],
    creator: "@loveoflearningbrewing",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicons/favicon-16x16.png" type="image/png" sizes="16x16" />
        <link rel="icon" href="/favicons/favicon-32x32.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/favicons/apple-touch-icon.png" />
        <link rel="manifest" href="/favicons/site.webmanifest" />
        <meta name="theme-color" content="#8B5A3C" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="LoL Brewing" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body
        className={`${poppins.variable} antialiased min-h-screen flex flex-col font-poppins`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LocationProvider>
            <Header />
            <main className="flex-1">
              {children}
            </main>
            <Footer />
            <Toaster />
          </LocationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
