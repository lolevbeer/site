/**
 * Site Content utilities
 * Fetch and manage site content from Payload CMS
 */

import { fetchGlobal } from './payload-api';
import { getMediaUrl } from './formatters';
import { logger } from '@/lib/utils/logger';

export interface SiteContent {
  heroDescription?: string;
  heroImageUrl?: string | null;
  errorMessage?: string;
  todaysEventsTitle?: string;
  todaysFoodTitle?: string;
}

/**
 * Fetch site content from Payload CMS
 */
export async function getSiteContent(): Promise<SiteContent> {
  try {
    const content = await fetchGlobal('site-content', 2) as any | null;
    return {
      heroDescription: content?.heroDescription,
      heroImageUrl: getMediaUrl(content?.heroImage),
      errorMessage: content?.errorMessage,
      todaysEventsTitle: content?.todaysEventsTitle,
      todaysFoodTitle: content?.todaysFoodTitle,
    };
  } catch (error) {
    logger.error('Failed to fetch site content:', error);
    return {};
  }
}
