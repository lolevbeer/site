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
      config?: Record<string, any>
    ) => void;
    dataLayer?: any[];
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

export const trackBeerFilter = (filterType: string, filterValue: string) => {
  trackEvent('filter_beers', {
    filter_type: filterType,
    filter_value: filterValue,
  });
};

export const trackBeerSort = (sortBy: string) => {
  trackEvent('sort_beers', {
    sort_by: sortBy,
  });
};

// Location-related events
export const trackLocationSwitch = (
  fromLocation: string,
  toLocation: string
) => {
  trackEvent('switch_location', {
    from_location: fromLocation,
    to_location: toLocation,
  });
};

export const trackDirections = (location: string) => {
  trackEvent('get_directions', {
    location: location,
  });
};

// Event-related events
export const trackEventView = (eventName: string, eventType: string) => {
  trackEvent('view_event', {
    event_name: eventName,
    event_type: eventType,
  });
};

export const trackEventRSVP = (eventName: string) => {
  trackEvent('rsvp_event', {
    event_name: eventName,
  });
};

// Food vendor events
export const trackFoodVendorView = (vendorName: string) => {
  trackEvent('view_food_vendor', {
    vendor_name: vendorName,
  });
};

export const trackMenuClick = (vendorName: string) => {
  trackEvent('view_menu', {
    vendor_name: vendorName,
  });
};

// Social media tracking
export const trackSocialClick = (platform: string, location?: string) => {
  trackEvent('social_click', {
    platform: platform,
    location: location,
  });
};

// Search tracking
export const trackSearch = (searchTerm: string, resultCount: number) => {
  trackEvent('search', {
    search_term: searchTerm,
    result_count: resultCount,
  });
};

// Map interactions
export const trackMapInteraction = (action: string, location?: string) => {
  trackEvent('map_interaction', {
    action: action,
    location: location,
  });
};

// Share tracking
export const trackShare = (contentType: string, contentName: string) => {
  trackEvent('share', {
    content_type: contentType,
    content_name: contentName,
  });
};

// External link tracking
export const trackExternalLink = (url: string, linkText?: string) => {
  trackEvent('click_external_link', {
    link_url: url,
    link_text: linkText,
  });
};

// Newsletter/email signup
export const trackEmailSignup = (location: string) => {
  trackEvent('email_signup', {
    signup_location: location,
  });
};

// Error tracking
export const trackError = (errorMessage: string, errorLocation: string) => {
  trackEvent('error', {
    error_message: errorMessage,
    error_location: errorLocation,
  });
};

// Performance tracking
export const trackTiming = (
  category: string,
  variable: string,
  value: number,
  label?: string
) => {
  trackEvent('timing_complete', {
    name: category,
    value: value,
    event_category: variable,
    event_label: label,
  });
};
