/**
 * Fetch Site SEO global (defaults + hub page overrides).
 */
import { cache } from 'react'
import { fetchGlobal } from './payload-api'
import { logger } from '@/lib/utils/logger'
import { SITE_TITLE, siteDescription, trim } from '@/lib/utils/seo'
import type { SiteSeo } from '@/src/payload-types'
import type { INTRO_PAGE_KEYS } from '@/src/globals/SiteSeo'

// Failures degrade to "no overrides" (code fallbacks) so a CMS hiccup never blanks page metadata.
export const getSiteSeo = cache(async (): Promise<Partial<SiteSeo>> => {
  try {
    return ((await fetchGlobal('site-seo', 1)) as SiteSeo | null) ?? {}
  } catch (error) {
    logger.error('Failed to fetch site SEO:', error)
    return {}
  }
})

/** CMS intro paragraph for a hub page, or undefined when blank. */
export async function getHubIntro(
  key: (typeof INTRO_PAGE_KEYS)[number],
): Promise<string | undefined> {
  return trim((await getSiteSeo()).pages?.[key]?.intro)
}

/** Site-wide title and description: the CMS default if set, else the code fallback. Shared by the layout and Home. */
export function siteDefaults(
  siteSeo: Partial<SiteSeo>,
  locations: Parameters<typeof siteDescription>[0],
) {
  return {
    title: trim(siteSeo.defaultTitle) ?? SITE_TITLE,
    description: trim(siteSeo.description) ?? siteDescription(locations),
  }
}
