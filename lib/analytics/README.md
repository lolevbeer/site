# Analytics Implementation Guide

## Overview

This site has comprehensive Google Analytics tracking implemented throughout. All tracking is lightweight and loads asynchronously to avoid impacting performance.

## What's Being Tracked

### Automatic Tracking
- **Page Views**: Every page navigation (including SPA navigation)
- **Standard GA4 Events**: Scroll depth, outbound clicks, file downloads, video engagement

### Custom Events

#### Beer Interactions
- `view_beer` - When user clicks to view beer details
  - Parameters: `beer_name`, `beer_type`
- `filter_beers` - When user applies beer filters
  - Parameters: `filter_type`, `filter_value`
- `sort_beers` - When user changes beer sorting
  - Parameters: `sort_by`

#### Location Interactions
- `switch_location` - When user switches between locations
  - Parameters: `from_location`, `to_location`
- `get_directions` - When user clicks for directions
  - Parameters: `location`

#### Map Interactions
- `map_interaction` - Map interactions (clicks, geolocation)
  - Parameters: `action`, `location`

#### Search
- `search` - When user searches (3+ characters)
  - Parameters: `search_term`, `result_count`

#### External Links
- `click_external_link` - External link clicks
  - Parameters: `link_url`, `link_text`
- `social_click` - Social media link clicks
  - Parameters: `platform`, `location`

## Usage Examples

### Basic Event Tracking

```typescript
import { trackBeerView, trackLocationSwitch } from '@/lib/analytics';

// Track beer view
trackBeerView('Hop Grenade', 'IPA');

// Track location switch
trackLocationSwitch('lawrenceville', 'zelienople');
```

### Using TrackedLink Component

```typescript
import { TrackedLink } from '@/lib/analytics';

// Automatic tracking for external links
<TrackedLink href="https://example.com" external>
  Visit Website
</TrackedLink>

// Automatic tracking for social media
<TrackedLink href="https://instagram.com/lolev" social="instagram">
  Follow Us
</TrackedLink>
```

### Custom Event Tracking

```typescript
import { trackEvent } from '@/lib/analytics';

// Track custom event
trackEvent('custom_event_name', {
  parameter1: 'value1',
  parameter2: 123,
  parameter3: true
});
```

## Implementation Details

### Components

1. **GoogleAnalytics** (`components/analytics/google-analytics.tsx`)
   - Loads GA4 script with `afterInteractive` strategy
   - Hardcoded measurement ID: `G-RR14DE5FPS`
   - No environment variables needed

2. **PageViewTracker** (`components/analytics/page-view-tracker.tsx`)
   - Tracks SPA navigation automatically
   - Integrated into root layout
   - Wrapped in Suspense boundary (Next.js 16 requirement)

3. **TrackedLink** (`components/analytics/tracked-link.tsx`)
   - Drop-in replacement for Next.js Link
   - Auto-tracks external and social links

### Event Functions

All event tracking functions are in `lib/analytics/events.ts`:

- Type-safe parameters
- Null-safe (won't error if GA not loaded)
- Client-side only (won't run during SSR)

## Performance Impact

- **GA Script**: ~17KB gzipped
- **Tracking Utilities**: ~2KB (tree-shaken if unused)
- **Page Tracker**: ~0.5KB

Total: **~20KB** with **zero impact** on initial page load (loads after interactive).

## Testing

### Check if tracking is working:

1. **Browser DevTools**:
   - Network tab → filter "gtag" or "collect"
   - Should see requests to `google-analytics.com`

2. **Console**:
   ```javascript
   // Check dataLayer
   console.log(window.dataLayer);
   ```

3. **GA4 Real-Time Report**:
   - Go to [Google Analytics](https://analytics.google.com/)
   - Reports → Realtime
   - Should see your session within 30 seconds

## Adding New Tracking

To add a new tracked event:

1. Add the event function to `lib/analytics/events.ts`:

```typescript
export const trackYourEvent = (param: string) => {
  trackEvent('your_event_name', {
    your_parameter: param,
  });
};
```

2. Export it from `lib/analytics/index.ts`

3. Import and use in your component:

```typescript
import { trackYourEvent } from '@/lib/analytics';

const handleAction = () => {
  trackYourEvent('value');
  // ... rest of your code
};
```

## Current Tracked Components

- ✅ Location selector/switcher/tabs
- ✅ Beer cards (view details)
- ✅ Beer filters (style, availability, search)
- ✅ Location cards (directions)
- ✅ Map interactions (clicks, geolocation)
- ✅ Page views (all routes)

## Best Practices

1. **Don't over-track**: Only track meaningful user actions
2. **Use descriptive names**: Event names should be clear
3. **Include context**: Add relevant parameters
4. **Test locally**: Check Network tab before deploying
5. **Respect privacy**: No PII (personally identifiable information)

## Configuration

- **Measurement ID**: `G-RR14DE5FPS` (hardcoded in `GoogleAnalytics` component)
- **No environment variables required**
- **Works in all environments** (dev, staging, production)

## Analytics Reports to Create

Recommended custom reports in GA4:

1. **Beer Popularity**: `view_beer` events grouped by `beer_name`
2. **Location Preferences**: `switch_location` events analysis
3. **Search Effectiveness**: `search` events with `result_count`
4. **User Journey**: Page flow from homepage to beer details
5. **External Engagement**: `social_click` and `click_external_link` events

## Troubleshooting

**Events not showing up?**
- Check browser console for errors
- Verify GA measurement ID is correct
- Ad blockers may block GA (expected)
- Check Network tab for blocked requests

**Events delayed?**
- GA4 can take 24-48 hours for full reporting
- Use Real-Time reports for immediate verification

**TypeScript errors?**
- Ensure you're importing from `@/lib/analytics`
- Check parameter types match function signatures
