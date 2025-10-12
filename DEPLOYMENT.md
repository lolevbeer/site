# Deployment Guide

## Overview

This Next.js application is configured for deployment on Vercel with subdomain setup at `next.lolev.beer`.

## Configuration Files Created

### 1. `app/layout.tsx`
- Updated with comprehensive metadata for SEO
- Added OpenGraph and Twitter card support
- Integrated LocationProvider wrapper
- Added proper PWA meta tags

### 2. `app/page.tsx`
- New homepage with hero section
- Featured beer grid with location switching
- Upcoming events display
- Location information cards

### 3. `package.json`
- Updated build scripts (removed --turbopack from build for production)
- Added additional useful scripts (lint:fix, type-check, preview, clean)

### 4. `.env.example`
- Comprehensive environment variables template
- API configuration options
- Social media URLs
- Feature flags
- Analytics and tracking setup

### 5. `vercel.json`
- Production deployment configuration
- CORS headers for API routes
- Security headers
- Image caching optimization
- URL redirects and rewrites
- Clean URLs enabled

### 6. `next.config.mjs`
- Image optimization with multiple domains
- Security headers configuration
- Redirects for legacy URLs
- Performance optimizations
- Bundle analysis support (dev only)

## Additional Files

### SEO & PWA
- `/app/api/robots/route.ts` - Dynamic robots.txt
- `/app/api/sitemap/route.ts` - Dynamic sitemap.xml
- `/public/manifest.json` - PWA manifest

## Deployment Steps

### 1. Environment Setup
Copy `.env.example` to `.env.local` and fill in required values:

```bash
cp .env.example .env.local
```

Key variables to set:
- `NEXT_PUBLIC_APP_URL=https://next.lolev.beer`
- `GOOGLE_SITE_VERIFICATION` (if using Google Search Console)
- Social media URLs
- Analytics tracking IDs

### 2. Vercel Deployment

#### Option A: Vercel CLI
```bash
npm install -g vercel
vercel --prod
```

#### Option B: Git Integration
1. Connect repository to Vercel
2. Configure subdomain: `next.lolev.beer`
3. Set environment variables in Vercel dashboard
4. Deploy automatically on push

### 3. Domain Configuration
1. Set up `next.lolev.beer` subdomain in DNS
2. Point to Vercel's servers
3. Configure SSL certificate (automatic with Vercel)

### 4. Post-Deployment Checklist
- [ ] Test all pages load correctly
- [ ] Verify location switching works
- [ ] Check beer grid displays sample data
- [ ] Confirm API routes respond correctly
- [ ] Test mobile responsiveness
- [ ] Validate SEO meta tags
- [ ] Check PWA manifest
- [ ] Verify security headers

## Performance Features

### Image Optimization
- WebP and AVIF format support
- Multiple device size breakpoints
- Optimized caching headers
- Remote image domain configuration

### Caching Strategy
- Static assets: 1 year cache
- API responses: Configurable per endpoint
- Sitemap/Robots: 1 day cache

### Security Headers
- Content Security Policy
- XSS Protection
- Frame Options
- CORS configuration for API routes

## API Endpoints

### Data Routes
- `/api/data/beer` - Beer information
- `/api/data/events` - Event listings
- `/api/data/food` - Food vendor schedule

### SEO Routes
- `/api/robots` - Robots.txt generation
- `/api/sitemap` - Sitemap.xml generation

## Features Included

### Location Management
- Two-location brewery support (Lawrenceville & Zelienople)
- Location-specific data filtering
- Location switching interface

### Beer Display
- Responsive beer grid
- Sample data integration
- Filtering and sorting capabilities
- Individual beer detail pages

### Events System
- Event listing with featured events
- Location-based event filtering
- Event detail display

### Food Vendors
- Weekly food vendor schedule
- Vendor information display
- Location-specific schedules

## Development

### Local Development
```bash
npm run dev
```

### Type Checking
```bash
npm run type-check
```

### Linting
```bash
npm run lint
npm run lint:fix
```

### Build Preview
```bash
npm run preview
```

## Monitoring

Consider setting up:
- Error tracking (Sentry integration ready)
- Analytics (Google Analytics/Tag Manager ready)
- Performance monitoring
- Uptime monitoring

## Support

For deployment issues, check:
1. Vercel deployment logs
2. Browser console for client-side errors
3. Network tab for API call failures
4. Environment variable configuration