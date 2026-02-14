/**
 * Site Content utilities
 * Fetch and manage site content from Payload CMS
 */

import { fetchGlobal } from './payload-api';
import { getMediaUrl } from './media-utils';
import { logger } from '@/lib/utils/logger';
import type { SiteContent as PayloadSiteContent } from '@/src/payload-types';

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
    const content = await fetchGlobal('site-content', 2) as PayloadSiteContent | null;
    return {
      heroDescription: content?.heroDescription ?? undefined,
      heroImageUrl: getMediaUrl(content?.heroImage),
      errorMessage: content?.errorMessage ?? undefined,
      todaysEventsTitle: content?.todaysEventsTitle ?? undefined,
      todaysFoodTitle: content?.todaysFoodTitle ?? undefined,
    };
  } catch (error) {
    logger.error('Failed to fetch site content:', error);
    return {};
  }
}
