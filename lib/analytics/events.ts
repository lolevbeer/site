/**
 * Google Analytics event tracking utilities
 * Provides type-safe custom event tracking for user interactions
 */

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

// Beer-related events
export const trackBeerView = (beerName: string, beerType: string) => {
  trackEvent('view_beer', {
    beer_name: beerName,
    beer_type: beerType,
  });
};

// Location-related events
export const trackDirections = (location: string) => {
  trackEvent('get_directions', {
    location: location,
  });
};

// Social media tracking
export const trackSocialClick = (platform: string, location?: string) => {
  trackEvent('social_click', {
    platform: platform,
    location: location,
  });
};

// Map interactions
export const trackMapInteraction = (action: string, location?: string) => {
  trackEvent('map_interaction', {
    action: action,
    location: location,
  });
};

// External link tracking
export const trackExternalLink = (url: string, linkText?: string) => {
  trackEvent('click_external_link', {
    link_url: url,
    link_text: linkText,
  });
};
