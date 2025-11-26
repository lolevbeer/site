/**
 * Site Content utilities
 * Fetch and manage site content from Payload CMS
 */

import { fetchGlobal } from './payload-api';

export interface SiteContent {
  heroDescription?: string;
  errorMessage?: string;
  todaysEventsTitle?: string;
  todaysFoodTitle?: string;
}

const DEFAULT_CONTENT: SiteContent = {
  heroDescription: "Brewed in Pittsburgh's vibrant Lawrenceville neighborhood, housed in a historic building that has stood since 1912. Lolev focuses on modern ales, expressive lagers and oak-aged beer.\n\nWe believe that beer should be thoughtful and stimulating. Each beer we create is intended to engage your senses, crafted with attention to flavor, balance, and the experience.",
  errorMessage: "We encountered an unexpected error. Don't worry, your data is safe.",
  todaysEventsTitle: "Today's Event",
  todaysFoodTitle: "Today's Food",
};

/**
 * Fetch site content from Payload CMS
 */
export async function getSiteContent(): Promise<SiteContent> {
  try {
    const content = await fetchGlobal('site-content');
    return {
      heroDescription: content?.heroDescription,
      errorMessage: content?.errorMessage,
      todaysEventsTitle: content?.todaysEventsTitle,
      todaysFoodTitle: content?.todaysFoodTitle,
    };
  } catch (error) {
    console.error('Failed to fetch site content:', error);
    return {};
  }
}
