/**
 * Analytics event helpers. `trackEvent` sends to Google Analytics only;
 * `trackConversion` sends to both Vercel Web Analytics and Google Analytics.
 * The full list of events sent is in lib/analytics/README.md.
 */

import { track } from '@vercel/analytics'

// Extend the Window interface to include gtag
declare global {
  interface Window {
    gtag?: (
      command: string,
      targetId: string,
      config?: Record<string, string | number | boolean | undefined>
    ) => void;
    dataLayer?: Array<Record<string, unknown>>;
  }
}

// Event parameter types for better type safety
interface EventParams {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Send a custom event to Google Analytics
 */
export const trackEvent = (
  eventName: string,
  params?: EventParams
): void => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, params);
  }
};

/** Send a conversion (call, directions, form submit, ...) to Vercel Analytics and GA. */
export const trackConversion = (
  eventName: string,
  params?: Record<string, string>
): void => {
  track(eventName, params)
  trackEvent(eventName, params)
};

// Beer-related events
export const trackBeerView = (beerName: string, beerType: string) => {
  trackEvent('view_beer', {
    beer_name: beerName,
    beer_type: beerType,
  });
};

// Map interactions
export const trackMapInteraction = (action: string, location?: string) => {
  trackEvent('map_interaction', {
    action: action,
    location: location,
  });
};
