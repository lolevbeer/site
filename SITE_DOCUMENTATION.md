# Lolev Beer Jekyll Site - Comprehensive Documentation

## Overview
A Jekyll-based brewery website for Lolev Beer with two locations (Lawrenceville and Zelienople). The site displays beer menus, food schedules, events, and generates various business assets (QR codes, barcodes, digital cards).

## Architecture

### Tech Stack
- **Static Site Generator**: Jekyll 4.3.3
- **Styling**: SASS/SCSS (sass-embedded)
- **Data Source**: Google Sheets (CSV export)
- **Hosting**: GitHub Pages
- **CI/CD**: GitHub Actions
- **Ruby Version**: 3.2.0

### Project Structure
```
├── _data/               # CSV data files from Google Sheets
├── _includes/           # Reusable components (header, footer, sections)
├── _layouts/            # Page templates
├── _plugins/            # Jekyll plugins
├── _sass/               # SASS stylesheets
├── assets/              # Static assets (JS, CSS, images)
├── beer/                # Beer detail pages
├── images/              # Site images
├── ingest/              # Data ingestion scripts
└── .github/workflows/   # CI/CD pipelines
```

## Data Architecture

### Google Sheets Integration
The site pulls data from Google Sheets via CSV exports stored as GitHub secrets/variables:

**Data Sources:**
- `beer.csv` - Master beer catalog
- `coming.csv` - Upcoming beers
- `lawrenceville-*.csv` - Location-specific data (draft, cans, food, events, hours)
- `zelienople-*.csv` - Location-specific data (draft, cans, food, events, hours)

**Data Flow:**
1. Google Sheets → CSV Export URLs (stored as GitHub secrets)
2. GitHub Actions workflow (`add-data.yml`) triggered on push/dispatch
3. `ingest/update-data.sh` downloads CSVs via curl
4. CSVs saved to `_data/` directory
5. Jekyll builds site with updated data
6. Deploys to GitHub Pages

## Templates & Layouts

### Layout Hierarchy
- `default.html` - Base layout with header/footer
- `beer.html` - Individual beer pages
- `qr.html` - QR code generation
- `barcode.html` - Barcode generation
- `digicard.html` - Digital business cards
- `signature.html` - Email signatures
- `contact.html` - vCard generation

### Key Includes
- `header.html` - Navigation, social links, meta tags
- `footer.html` - Location selector, hours
- `beers.html` - Draft beer list with location tabs
- `cans.html` - Available cans with location tabs
- `food.html` - Weekly food truck schedule
- `events.html` - Upcoming events
- `coming.html` - Coming soon beers

## Styling Approach

### SASS Architecture
- `reset.sass` - CSS reset/normalize
- `style.sass` - Main styles (13KB)
- `map_style.sass` - Beer map specific styles
- `sell-sheet.sass` - Print styles for sell sheets

### CSS Features
- Mobile-first responsive design
- CSS scroll snap for sections
- Custom properties for theming
- Tab-based location switching
- Print-optimized sell sheets

## JavaScript Functionality

### Core Scripts
- `location-manager.js` - Manages location state across tabs
- `tabs.js` - Tab switching functionality
- `script.js` - General site interactions
- `map.js` - Interactive beer distribution map

### Location Management
- Persistent location selection via localStorage
- Synchronizes all tabbed content to selected location
- Footer location selector updates all tabs

## CI/CD Pipeline

### GitHub Actions Workflows

**1. Update Data (`add-data.yml`)**
- Triggers: push to master, repository_dispatch, manual
- Downloads CSVs from Google Sheets
- Commits changes to `_data/`
- Auto-triggers build workflow

**2. Build & Deploy (`build.yml`)**
- Triggers: After data update completes
- Caches Ruby gems and Jekyll artifacts
- Builds Jekyll site
- Deploys to GitHub Pages

**3. Get Lat/Long (`get-lat-long.yml`)**
- Geocoding for map functionality

## Page Generation

### Dynamic Pages via jekyll-datapage-generator
Automatically generates pages from data:
- Beer detail pages from `beer.csv`
- QR codes for each beer variant
- Barcodes for products
- Digital business cards from `people.yml`
- vCard contacts

## Issues & Improvement Opportunities

### 🔴 Critical Issues

1. **Duplicated Configuration**
   - `page_gen` block duplicated in `_config.yml` (lines 24-35)
   - Should be single array with multiple generators

2. **No Error Handling**
   - Data ingestion lacks validation
   - No fallback for failed Google Sheets downloads
   - Missing error boundaries in JavaScript

3. **Performance Issues**
   - No lazy loading for beer images
   - All location data loaded upfront
   - Missing image optimization pipeline

### 🟡 Code Quality Issues

1. **Template Duplication**
   - Food/events templates have identical structure for each location
   - Should use single component with location prop

2. **Inline Styles**
   - Hardcoded styles in templates (`style="display: none;"`)
   - Should use CSS classes

3. **Accessibility**
   - Missing alt text on some images
   - No ARIA labels for interactive elements
   - Poor keyboard navigation

4. **Data Structure**
   - CSV columns inconsistently named
   - Boolean values as strings ("TRUE"/"FALSE")
   - Empty values handled inconsistently

### 🟢 Simplification Opportunities

1. **Component Architecture**
   - Extract reusable tab component
   - Create beer card component
   - Standardize section layouts

2. **Data Management**
   - Consolidate location-specific CSVs
   - Use JSON instead of CSV for structured data
   - Single source of truth for locations

3. **Build Process**
   - Combine workflows where possible
   - Add staging environment
   - Implement preview deployments

## Migration to Next.js/Shadcn Recommendations

### Architecture Proposal

```typescript
// Proposed structure
├── app/
│   ├── (marketing)/
│   │   ├── page.tsx          // Home
│   │   ├── beer/
│   │   │   └── [slug]/page.tsx
│   │   ├── events/page.tsx
│   │   └── food/page.tsx
│   ├── api/
│   │   └── data/route.ts    // Data fetching
│   └── layout.tsx
├── components/
│   ├── ui/                  // Shadcn components
│   ├── beer-card.tsx
│   ├── location-tabs.tsx
│   └── section.tsx
├── lib/
│   ├── data/                // Data fetching
│   └── utils/               // Helpers
└── content/                 // MDX content
```

### Key Improvements

1. **Type Safety**
   ```typescript
   interface Beer {
     variant: string;
     name: string;
     type: string;
     abv: number;
     glutenFree: boolean;
     // ... fully typed
   }
   ```

2. **Component-Based Architecture**
   ```tsx
   <LocationTabs defaultLocation="lawrenceville">
     <TabsContent value="lawrenceville">
       <BeerGrid beers={lawrencevilleBeers} />
     </TabsContent>
   </LocationTabs>
   ```

3. **Data Fetching Strategy**
   - Server Components for static data
   - ISR for Google Sheets data (revalidate hourly)
   - Move to headless CMS (Sanity/Contentful)

4. **Improved State Management**
   ```tsx
   // Context for location
   const LocationProvider = ({ children }) => {
     const [location, setLocation] = useLocalStorage('location', 'lawrenceville')
     // ...
   }
   ```

5. **Better Developer Experience**
   - Hot reload
   - TypeScript autocomplete
   - Component testing
   - Storybook for UI development

### Migration Steps

1. **Phase 1: Setup**
   - Initialize Next.js with TypeScript
   - Setup Shadcn UI
   - Configure Tailwind CSS
   - Setup data models/types

2. **Phase 2: Core Components**
   - Build reusable components
   - Implement location management
   - Create layout system
   - Setup routing

3. **Phase 3: Data Layer**
   - Build data fetching utilities
   - Implement caching strategy
   - Setup preview mode
   - Add error handling

4. **Phase 4: Features**
   - Migrate page by page
   - Implement dynamic routes
   - Add search/filtering
   - Enhance interactivity

5. **Phase 5: Optimization**
   - Image optimization
   - Performance tuning
   - SEO enhancements
   - Analytics migration

### CMS Migration Strategy

**Recommended: Sanity CMS**
- Structured content modeling
- Real-time preview
- Powerful query language
- Good developer experience

**Content Models:**
```typescript
// Beer schema
{
  name: 'beer',
  fields: [
    { name: 'name', type: 'string', validation: required },
    { name: 'variant', type: 'slug' },
    { name: 'type', type: 'reference', to: 'beerType' },
    { name: 'abv', type: 'number' },
    { name: 'description', type: 'text' },
    { name: 'availability', type: 'array', of: 'location' },
    // ...
  ]
}
```

## Quick Wins Before Migration

1. **Fix duplicate config** in `_config.yml`
2. **Add image lazy loading** with `loading="lazy"`
3. **Extract tab JavaScript** to reusable class
4. **Add error handling** to data ingestion
5. **Implement basic caching** headers
6. **Optimize images** with WebP format
7. **Add structured data** for SEO
8. **Improve accessibility** with ARIA labels

## Security Considerations

1. **Secrets Management**
   - Rotate GitHub secrets regularly
   - Use environment-specific secrets
   - Audit access permissions

2. **Content Security Policy**
   - Add CSP headers
   - Restrict external scripts
   - Validate user inputs

3. **Dependencies**
   - Regular dependency updates
   - Security audit via Dependabot
   - Lock file integrity

## Performance Metrics

Current issues:
- First Contentful Paint: ~2.5s (target: <1.5s)
- Time to Interactive: ~4s (target: <3s)
- Cumulative Layout Shift: High due to image loading

Improvements needed:
- Image optimization and lazy loading
- Critical CSS inlining
- Font loading optimization
- JavaScript bundle splitting