/**
 * Analytics Module
 * Centralized exports for all analytics functionality
 */

// Event tracking functions
export {
  trackEvent,
  trackBeerView,
  trackBeerFilter,
  trackBeerSort,
  trackLocationSwitch,
  trackDirections,
  trackEventView,
  trackEventRSVP,
  trackFoodVendorView,
  trackMenuClick,
  trackSocialClick,
  trackSearch,
  trackMapInteraction,
  trackShare,
  trackExternalLink,
  trackEmailSignup,
  trackError,
  trackTiming,
} from './events';

// Re-export components (optional convenience)
export { GoogleAnalytics } from '@/components/analytics/google-analytics';
export { PageViewTracker } from '@/components/analytics/page-view-tracker';
export { TrackedLink } from '@/components/analytics/tracked-link';
