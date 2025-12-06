# LOLEV Beer Website Constitution

## Core Principles

### I. Location-First Architecture
All features must support multi-location operation from inception. Data, UI, and business logic must be location-aware without hardcoding specific location names. New locations should be addable via CMS without code changes.

### II. Data Source Flexibility
The system supports multiple data sources (Payload CMS, Google Sheets, CSV files). New features should work with the Payload-first approach while maintaining backward compatibility with CSV/Sheets sync for operational flexibility.

### III. Server-First Rendering
Leverage Next.js App Router and React Server Components for initial render. Client components are used only when interactivity is required (filtering, location switching, real-time updates). This ensures fast initial load and SEO compliance.

### IV. Content Manager Empowerment
Non-technical staff must be able to update core content (menus, events, food schedules) without developer intervention. This is achieved through Payload CMS admin and Google Sheets sync. UI should be intuitive and error-resistant.

### V. Operational Display Support
The website serves dual purposes: public information and in-venue display (TV menus). Display-mode routes (/m/*) must be optimized for readability at distance and auto-refresh capability.

### VI. Performance & Caching
Use React cache() for request-level deduplication. Parallel data fetching where possible. Lazy load below-the-fold components. Optimize images via Next.js Image and Vercel Blob. Target sub-3-second mobile load times.

### VII. Type Safety
Full TypeScript coverage. Payload generates types from collections. All data flows typed end-to-end. Zod schemas for runtime validation at boundaries.

## Technology Constraints

### Required Stack
- **Framework**: Next.js 15+ (App Router)
- **CMS**: Payload CMS 3.x
- **Database**: MongoDB
- **Styling**: Tailwind CSS + Shadcn/ui
- **Deployment**: Vercel
- **Image Storage**: Vercel Blob

### Prohibited Patterns
- Hardcoded location references (use location context/config)
- Client-side data fetching for initial page load (use RSC)
- Direct MongoDB queries outside Payload (use Payload Local API)
- Inline styles (use Tailwind classes)
- Non-accessible UI patterns (follow WCAG 2.1 AA)

## Development Workflow

### Code Changes
1. Create feature branch from `main`
2. Implement with tests where applicable
3. Verify TypeScript compilation passes
4. Test manually at both locations
5. Create PR with clear description
6. Merge after review

### Data Model Changes
1. Update Payload collection definition
2. Run `pnpm payload generate:types`
3. Update any affected utilities/components
4. Test sync functionality if applicable
5. Verify admin UI works correctly

### Content Updates (Non-Dev)
1. **Quick updates**: Edit in Payload CMS admin
2. **Bulk updates**: Update Google Sheets, trigger sync
3. **Menu changes**: Update menu items in CMS, auto-deploys

## Quality Gates

- TypeScript must compile without errors
- No console errors in browser
- Pages must be accessible (axe-core clean)
- Mobile-responsive (test at 375px width)
- Location switching must work correctly
- SEO structured data must be valid

## Governance

This constitution defines the architectural principles for the LOLEV Beer website. All new features and modifications must align with these principles. Deviations require explicit justification and team consensus.

**Version**: 1.0.0 | **Ratified**: 2025-12-06 | **Last Amended**: 2025-12-06
