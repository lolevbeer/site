# Next.js TypeScript Migration Plan - Lolev Beer

## Executive Summary

Complete rebuild of the Lolev Beer website from Jekyll to Next.js 14+ with TypeScript, Shadcn UI, and modern architecture patterns. This plan prioritizes performance, maintainability, and developer experience while maintaining current functionality and preparing for future CMS integration.

## Project Setup & Configuration

### Core Technologies

```json
{
  "framework": "Next.js 14+ (App Router)",
  "language": "TypeScript 5.0+",
  "styling": "Tailwind CSS 3.4+",
  "components": "Shadcn UI",
  "database": "PostgreSQL (Supabase/Vercel Postgres)",
  "cms": "Sanity CMS (Phase 2)",
  "deployment": "Vercel",
  "analytics": "Vercel Analytics + Google Analytics 4",
  "monitoring": "Sentry"
}
```

### Initial Setup Commands

```bash
# Create Next.js project with TypeScript
npx create-next-app@latest lolev-next --typescript --tailwind --app --eslint
cd lolev-next

# Install core dependencies
npm install @radix-ui/react-tabs @radix-ui/react-dialog @radix-ui/react-select
npm install lucide-react class-variance-authority clsx tailwind-merge
npm install date-fns zod @tanstack/react-query axios
npm install react-hook-form @hookform/resolvers

# Development dependencies
npm install -D @types/node prettier eslint-config-prettier
npm install -D @testing-library/react @testing-library/jest-dom jest

# Shadcn UI setup
npx shadcn-ui@latest init
```

## Project Architecture

### Directory Structure

```
lolev-next/
├── app/
│   ├── (marketing)/
│   │   ├── layout.tsx                 # Marketing layout with header/footer
│   │   ├── page.tsx                   # Home page
│   │   ├── beer/
│   │   │   ├── page.tsx               # Beer listing
│   │   │   └── [slug]/
│   │   │       ├── page.tsx           # Beer detail
│   │   │       └── opengraph-image.tsx # Dynamic OG images
│   │   ├── events/
│   │   │   └── page.tsx               # Events listing
│   │   ├── food/
│   │   │   └── page.tsx               # Food schedule
│   │   ├── map/
│   │   │   └── page.tsx               # Beer distribution map
│   │   └── wholesale/
│   │       └── page.tsx               # Wholesale info
│   ├── (tools)/
│   │   ├── qr/[variant]/page.tsx     # QR code generator
│   │   ├── barcode/[variant]/page.tsx # Barcode generator
│   │   └── card/[id]/page.tsx        # Digital business card
│   ├── api/
│   │   ├── data/
│   │   │   ├── sync/route.ts         # Google Sheets sync
│   │   │   ├── beer/route.ts         # Beer data endpoint
│   │   │   └── events/route.ts       # Events endpoint
│   │   ├── webhooks/
│   │   │   └── sheets/route.ts       # Google Sheets webhook
│   │   └── revalidate/route.ts       # ISR revalidation
│   ├── layout.tsx                     # Root layout
│   ├── error.tsx                      # Error boundary
│   └── not-found.tsx                  # 404 page
├── components/
│   ├── ui/                            # Shadcn UI components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── select.tsx
│   │   ├── tabs.tsx
│   │   └── ...
│   ├── layout/
│   │   ├── header.tsx
│   │   ├── footer.tsx
│   │   ├── navigation.tsx
│   │   └── mobile-menu.tsx
│   ├── beer/
│   │   ├── beer-card.tsx
│   │   ├── beer-grid.tsx
│   │   ├── beer-details.tsx
│   │   └── beer-filters.tsx
│   ├── location/
│   │   ├── location-provider.tsx
│   │   ├── location-selector.tsx
│   │   └── location-tabs.tsx
│   ├── events/
│   │   ├── event-card.tsx
│   │   ├── event-list.tsx
│   │   └── event-calendar.tsx
│   └── food/
│       ├── food-schedule.tsx
│       └── vendor-card.tsx
├── lib/
│   ├── types/
│   │   ├── beer.ts
│   │   ├── event.ts
│   │   ├── food.ts
│   │   └── location.ts
│   ├── data/
│   │   ├── fetchers.ts
│   │   ├── transformers.ts
│   │   └── cache.ts
│   ├── hooks/
│   │   ├── use-location.ts
│   │   ├── use-beer-data.ts
│   │   └── use-local-storage.ts
│   ├── utils/
│   │   ├── cn.ts
│   │   ├── dates.ts
│   │   └── formatters.ts
│   └── config/
│       ├── site.ts
│       ├── locations.ts
│       └── navigation.ts
├── styles/
│   ├── globals.css
│   └── fonts.ts
├── public/
│   ├── images/
│   ├── favicons/
│   └── fonts/
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

## Data Models & Type Definitions

### Core Type Definitions

```typescript
// lib/types/beer.ts
export interface Beer {
  id: string;
  variant: string;
  name: string;
  type: BeerType;
  style: string;
  abv: number;
  ibu?: number;
  description: string;
  glutenFree: boolean;
  availability: BeerAvailability;
  pricing: BeerPricing;
  images: BeerImages;
  metadata: BeerMetadata;
}

export interface BeerAvailability {
  draft: Location[];
  cans: Location[];
  hideFromSite: boolean;
}

export interface BeerPricing {
  draftPrice?: number;
  canSingle?: number;
  fourPack?: number;
  sixPack?: number;
}

export interface BeerImages {
  can?: string;
  logo?: string;
  label?: string;
  og?: string;
}

export interface BeerMetadata {
  upc?: string;
  untappd?: string;
  recipe?: number;
  hops?: string[];
  malts?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// lib/types/location.ts
export enum LocationId {
  Lawrenceville = 'lawrenceville',
  Zelienople = 'zelienople'
}

export interface Location {
  id: LocationId;
  name: string;
  address: Address;
  hours: Hours[];
  contact: ContactInfo;
  coordinates: Coordinates;
}

export interface Hours {
  dayOfWeek: DayOfWeek;
  open: string;
  close: string;
  isOpen: boolean;
}

// lib/types/event.ts
export interface Event {
  id: string;
  title: string;
  description?: string;
  date: Date;
  startTime: string;
  endTime?: string;
  location: LocationId;
  vendor?: Vendor;
  category: EventCategory;
  image?: string;
  url?: string;
}

export enum EventCategory {
  Music = 'music',
  Food = 'food',
  Special = 'special',
  Trivia = 'trivia',
  Market = 'market'
}

// lib/types/food.ts
export interface FoodVendor {
  id: string;
  name: string;
  cuisine: string;
  website?: string;
  instagram?: string;
  menu?: string;
}

export interface FoodSchedule {
  id: string;
  vendor: FoodVendor;
  location: LocationId;
  date: Date;
  startTime: string;
  endTime: string;
}
```

## Component Architecture

### Core Components

```tsx
// components/beer/beer-card.tsx
import { Beer } from '@/lib/types/beer';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import Link from 'next/link';

interface BeerCardProps {
  beer: Beer;
  variant?: 'default' | 'compact' | 'detailed';
}

export function BeerCard({ beer, variant = 'default' }: BeerCardProps) {
  return (
    <Link href={`/beer/${beer.variant}`}>
      <Card className="group hover:shadow-lg transition-all duration-200">
        <CardHeader>
          {beer.images.can && (
            <div className="relative aspect-[3/4] overflow-hidden rounded-md">
              <Image
                src={beer.images.can}
                alt={beer.name}
                fill
                className="object-cover group-hover:scale-105 transition-transform"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            </div>
          )}
        </CardHeader>
        <CardContent>
          <h3 className="font-semibold text-lg">{beer.name}</h3>
          <p className="text-sm text-muted-foreground">{beer.style}</p>
          <div className="flex items-center justify-between mt-2">
            <Badge variant="secondary">{beer.abv}% ABV</Badge>
            {beer.glutenFree && (
              <Badge variant="outline">Gluten Free</Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// components/location/location-tabs.tsx
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLocation } from '@/lib/hooks/use-location';
import { LocationId } from '@/lib/types/location';

interface LocationTabsProps {
  children: (location: LocationId) => React.ReactNode;
  className?: string;
}

export function LocationTabs({ children, className }: LocationTabsProps) {
  const { location, setLocation } = useLocation();

  return (
    <Tabs
      value={location}
      onValueChange={(value) => setLocation(value as LocationId)}
      className={className}
    >
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value={LocationId.Lawrenceville}>
          Lawrenceville
        </TabsTrigger>
        <TabsTrigger value={LocationId.Zelienople}>
          Zelienople
        </TabsTrigger>
      </TabsList>
      <TabsContent value={LocationId.Lawrenceville}>
        {children(LocationId.Lawrenceville)}
      </TabsContent>
      <TabsContent value={LocationId.Zelienople}>
        {children(LocationId.Zelienople)}
      </TabsContent>
    </Tabs>
  );
}
```

## Data Layer Architecture

### Data Fetching Strategy

```typescript
// lib/data/fetchers.ts
import { cache } from 'react';
import { Beer, Event, FoodSchedule } from '@/lib/types';

// Server-side data fetching with React cache
export const getBeerList = cache(async (): Promise<Beer[]> => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/data/beer`, {
    next: { revalidate: 3600 }, // ISR: revalidate every hour
  });

  if (!response.ok) {
    throw new Error('Failed to fetch beer data');
  }

  return response.json();
});

export const getBeerBySlug = cache(async (slug: string): Promise<Beer | null> => {
  const beers = await getBeerList();
  return beers.find(beer => beer.variant === slug) || null;
});

// Client-side data fetching with React Query
// lib/hooks/use-beer-data.ts
import { useQuery } from '@tanstack/react-query';
import { Beer } from '@/lib/types/beer';
import { LocationId } from '@/lib/types/location';

export function useBeerData(location?: LocationId) {
  return useQuery({
    queryKey: ['beers', location],
    queryFn: async () => {
      const params = location ? `?location=${location}` : '';
      const response = await fetch(`/api/data/beer${params}`);
      if (!response.ok) throw new Error('Failed to fetch beers');
      return response.json() as Promise<Beer[]>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
}
```

### Google Sheets Integration (Phase 1)

```typescript
// app/api/data/sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { z } from 'zod';

const sheets = google.sheets('v4');

// Schema validation for incoming data
const BeerSchema = z.object({
  variant: z.string(),
  name: z.string(),
  type: z.string(),
  abv: z.string().transform(Number),
  glutenFree: z.enum(['TRUE', 'FALSE']).transform(v => v === 'TRUE'),
  // ... other fields
});

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret
    const secret = request.headers.get('x-webhook-secret');
    if (secret !== process.env.WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch data from Google Sheets
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheetsClient = sheets.spreadsheets.values;

    // Fetch beer data
    const beerData = await sheetsClient.get({
      auth,
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Beer!A:Z',
    });

    // Transform and validate data
    const beers = beerData.data.values?.slice(1).map(row => {
      const rawData = {
        variant: row[0],
        name: row[1],
        type: row[2],
        abv: row[4],
        glutenFree: row[11],
        // ... map other fields
      };

      return BeerSchema.parse(rawData);
    });

    // Store in database
    await storeBeerData(beers);

    // Revalidate ISR pages
    await revalidatePages(['/beer', '/']);

    return NextResponse.json({ success: true, count: beers?.length });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
```

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Setup & Configuration**
- [ ] Initialize Next.js project with TypeScript
- [ ] Configure Tailwind CSS and Shadcn UI
- [ ] Setup ESLint, Prettier, and Husky
- [ ] Configure environment variables
- [ ] Setup Vercel deployment pipeline
- [ ] Configure domain and DNS

**Core Infrastructure**
- [ ] Create type definitions for all data models
- [ ] Setup API routes structure
- [ ] Implement Google Sheets data fetching
- [ ] Create data transformation utilities
- [ ] Setup error handling and logging
- [ ] Configure Sentry for error tracking

**Base Components**
- [ ] Install and configure Shadcn UI components
- [ ] Create layout components (Header, Footer, Navigation)
- [ ] Implement location management system
- [ ] Build responsive mobile menu
- [ ] Setup font and asset optimization

### Phase 2: Core Features (Week 3-4)

**Homepage**
- [ ] Hero section with beer showcase
- [ ] Location selector
- [ ] Featured beers carousel
- [ ] Upcoming events preview
- [ ] Food truck schedule preview
- [ ] Social media links

**Beer Section**
- [ ] Beer listing page with filters
- [ ] Individual beer detail pages
- [ ] Dynamic OG image generation
- [ ] Beer availability by location
- [ ] Search and filter functionality
- [ ] Print-friendly sell sheets

**Events & Food**
- [ ] Events calendar component
- [ ] Weekly food truck schedule
- [ ] Location-based filtering
- [ ] Vendor information cards
- [ ] iCal export functionality

### Phase 3: Advanced Features (Week 5-6)

**Interactive Features**
- [ ] Beer distribution map
- [ ] QR code generator for beers
- [ ] Barcode generator
- [ ] Digital business cards
- [ ] Email signatures generator

**Performance Optimization**
- [ ] Image optimization pipeline
- [ ] Implement lazy loading
- [ ] Setup CDN for assets
- [ ] Optimize bundle size
- [ ] Implement service worker
- [ ] Add PWA capabilities

**SEO & Analytics**
- [ ] Meta tags and structured data
- [ ] XML sitemap generation
- [ ] Robots.txt configuration
- [ ] Google Analytics 4 integration
- [ ] Vercel Analytics setup
- [ ] Performance monitoring

### Phase 4: Data Migration (Week 7)

**Data Transfer**
- [ ] Export all Google Sheets data
- [ ] Clean and normalize data
- [ ] Setup PostgreSQL database
- [ ] Create migration scripts
- [ ] Validate data integrity
- [ ] Setup backup procedures

**Testing & QA**
- [ ] Unit tests for utilities
- [ ] Integration tests for API routes
- [ ] Component testing with React Testing Library
- [ ] E2E tests with Playwright
- [ ] Performance testing
- [ ] Accessibility audit

### Phase 5: CMS Integration (Week 8-9)

**Sanity CMS Setup**
- [ ] Initialize Sanity project
- [ ] Define content schemas
- [ ] Create custom input components
- [ ] Setup preview functionality
- [ ] Configure webhooks
- [ ] Implement incremental static regeneration

**Content Migration**
- [ ] Import existing content to CMS
- [ ] Train content editors
- [ ] Create documentation
- [ ] Setup staging environment
- [ ] Configure preview deployments

### Phase 6: Launch (Week 10)

**Pre-Launch Checklist**
- [ ] Security audit
- [ ] Performance audit
- [ ] SEO audit
- [ ] Cross-browser testing
- [ ] Mobile responsiveness check
- [ ] Load testing
- [ ] Backup and recovery test

**Launch Tasks**
- [ ] DNS cutover
- [ ] SSL certificate verification
- [ ] Monitor for errors
- [ ] Check analytics tracking
- [ ] Verify all redirects
- [ ] Submit sitemap to search engines

## Performance Targets

```typescript
// Performance budget configuration
export const performanceTargets = {
  lighthouse: {
    performance: 95,
    accessibility: 100,
    bestPractices: 100,
    seo: 100,
  },
  webVitals: {
    LCP: 2.5, // Largest Contentful Paint (seconds)
    FID: 100, // First Input Delay (milliseconds)
    CLS: 0.1, // Cumulative Layout Shift
    FCP: 1.5, // First Contentful Paint (seconds)
    TTFB: 600, // Time to First Byte (milliseconds)
  },
  bundle: {
    maxSize: '200kb', // JS bundle size (gzipped)
    maxChunks: 10,
    maxAsyncRequests: 6,
  },
};
```

## Security Implementation

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin');
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' *.vercel-insights.com *.google-analytics.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
  );

  // Rate limiting headers
  const ip = request.ip ?? '127.0.0.1';
  // Implement rate limiting logic here

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

## Monitoring & Analytics

```typescript
// lib/analytics.ts
import { Analytics } from '@vercel/analytics/react';
import { GoogleAnalytics } from '@next/third-parties/google';

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Analytics />
      <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID!} />
    </>
  );
}

// Custom event tracking
export function trackEvent(action: string, category: string, label?: string, value?: number) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
}
```

## Testing Strategy

```typescript
// tests/unit/beer.test.ts
import { describe, it, expect } from '@jest/globals';
import { transformBeerData, validateBeerData } from '@/lib/data/transformers';

describe('Beer Data Transformers', () => {
  it('should transform CSV data to Beer type', () => {
    const csvData = {
      variant: 'tides',
      name: 'Tides',
      type: 'IPA',
      abv: '7.5',
      glutenFree: 'FALSE',
    };

    const result = transformBeerData(csvData);

    expect(result).toMatchObject({
      variant: 'tides',
      name: 'Tides',
      abv: 7.5,
      glutenFree: false,
    });
  });

  it('should validate required fields', () => {
    const invalidData = { name: 'Test' };
    expect(() => validateBeerData(invalidData)).toThrow();
  });
});

// tests/e2e/beer-listing.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Beer Listing', () => {
  test('should display beers for selected location', async ({ page }) => {
    await page.goto('/beer');

    // Select Lawrenceville
    await page.click('[data-location="lawrenceville"]');
    await expect(page.locator('[data-test="beer-grid"]')).toBeVisible();

    // Check beer cards are displayed
    const beerCards = page.locator('[data-test="beer-card"]');
    await expect(beerCards).toHaveCountGreaterThan(0);

    // Navigate to beer detail
    await beerCards.first().click();
    await expect(page).toHaveURL(/\/beer\/.+/);
  });
});
```

## Deployment Configuration

```yaml
# vercel.json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "regions": ["iad1"],
  "functions": {
    "app/api/data/sync/route.ts": {
      "maxDuration": 30
    }
  },
  "crons": [
    {
      "path": "/api/data/sync",
      "schedule": "0 */6 * * *"
    }
  ],
  "redirects": [
    {
      "source": "/beers/:path*",
      "destination": "/beer/:path*",
      "permanent": true
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "s-maxage=60, stale-while-revalidate"
        }
      ]
    }
  ]
}
```

## Cost Estimation

### Development Costs
- **Development Time**: 10 weeks × 40 hours = 400 hours
- **Hourly Rate**: $150/hour
- **Total Development**: $60,000

### Infrastructure Costs (Monthly)
- **Vercel Pro**: $20/month
- **Sanity CMS**: $99/month (Growth plan)
- **PostgreSQL (Supabase)**: $25/month
- **Domain**: $15/year
- **Google Workspace**: $12/month
- **Total Monthly**: ~$156/month

### Third-Party Services
- **Sentry**: $26/month (Team plan)
- **Algolia Search** (optional): $50/month
- **CDN (Cloudflare)**: $20/month

## Success Metrics

### Technical KPIs
- Page Load Time: < 2 seconds
- Lighthouse Score: > 95
- Zero runtime errors in first month
- 99.9% uptime
- < 200ms API response time

### Business KPIs
- 30% increase in page views
- 50% reduction in bounce rate
- 25% increase in average session duration
- Improved SEO rankings
- Reduced content management time by 70%

## Risk Mitigation

### Technical Risks
1. **Data Loss**: Implement automated backups, version control
2. **Performance Issues**: Progressive enhancement, CDN, caching
3. **Browser Compatibility**: Transpilation, polyfills, testing
4. **Security Vulnerabilities**: Regular audits, dependency updates

### Business Risks
1. **SEO Impact**: 301 redirects, maintain URL structure
2. **Downtime**: Blue-green deployment, rollback procedures
3. **Training**: Comprehensive documentation, video tutorials
4. **Budget Overrun**: Phased approach, clear milestones

## Post-Launch Roadmap

### Month 1-2
- Bug fixes and optimizations
- User feedback integration
- Performance tuning
- SEO improvements

### Month 3-4
- Advanced search functionality
- User accounts and preferences
- Email newsletter integration
- Advanced analytics dashboard

### Month 5-6
- Mobile app development (React Native)
- Loyalty program integration
- Online ordering system
- Inventory management

## Conclusion

This comprehensive plan provides a structured approach to migrating from Jekyll to Next.js while improving performance, maintainability, and user experience. The phased implementation allows for iterative development and testing, ensuring a smooth transition with minimal disruption to the live site.

The modern stack provides excellent developer experience, type safety, and performance optimizations while setting up the foundation for future enhancements and integrations.