/**
 * Site Content utilities
 * Fetch and manage site content from Payload CMS
 */

import { fetchGlobal } from './payload-api';
import { getMediaUrl } from './media-utils';
import { logger } from '@/lib/utils/logger';
import type { SiteContent as PayloadSiteContent } from '@/src/payload-types';

export interface SiteContent {
  /** Rich copy staff edit; pages fall back to the plain field when it is missing. */
  heroDescriptionRich?: PayloadSiteContent['heroDescriptionRich'];
  aboutPhilosophyRich?: PayloadSiteContent['aboutPhilosophyRich'];
  aboutLocationsRich?: PayloadSiteContent['aboutLocationsRich'];
  heroDescription?: string;
  heroImageUrl?: string | null;
  errorMessage?: string;
  todaysEventsTitle?: string;
  todaysFoodTitle?: string;
  aboutPhilosophy?: string;
  aboutLocations?: string;
}

/**
 * Fetch site content from Payload CMS
 */
export async function getSiteContent(): Promise<SiteContent> {
  try {
    const content = await fetchGlobal('site-content', 2) as PayloadSiteContent | null;
    return {
      heroDescriptionRich: content?.heroDescriptionRich,
      aboutPhilosophyRich: content?.aboutPhilosophyRich,
      aboutLocationsRich: content?.aboutLocationsRich,
      heroDescription: content?.heroDescription ?? undefined,
      heroImageUrl: getMediaUrl(content?.heroImage),
      errorMessage: content?.errorMessage ?? undefined,
      todaysEventsTitle: content?.todaysEventsTitle ?? undefined,
      todaysFoodTitle: content?.todaysFoodTitle ?? undefined,
      aboutPhilosophy: content?.aboutPhilosophy ?? undefined,
      aboutLocations: content?.aboutLocations ?? undefined,
    };
  } catch (error) {
    logger.error('Failed to fetch site content:', error);
    throw error
  }
}
