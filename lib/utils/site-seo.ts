/**
 * Fetch Site SEO global (defaults + hub page overrides).
 */
import { cache } from 'react'
import { fetchGlobal } from './payload-api'
import { logger } from '@/lib/utils/logger'
import type { SiteSeoPageKey } from '@/src/globals/SiteSeo'
import type { SeoOverride, SiteSeoDefaults } from '@/lib/seo/resolve-metadata'

export type SiteSeoData = SiteSeoDefaults & {
  pages?: Partial<Record<SiteSeoPageKey, SeoOverride>> | null
}

export const getSiteSeo = cache(async (): Promise<SiteSeoData> => {
  try {
    const doc = (await fetchGlobal('site-seo', 1)) as SiteSeoData | null
    return doc ?? {}
  } catch (error) {
    logger.error('Failed to fetch site SEO:', error)
    return {}
  }
})

export function hubPageSeo(siteSeo: SiteSeoData, key: SiteSeoPageKey): SeoOverride {
  return siteSeo?.pages?.[key] ?? null
}
