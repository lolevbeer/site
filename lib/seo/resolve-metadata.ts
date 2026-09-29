/**
 * Merge CMS SEO overrides with code fallbacks into Next.js Metadata.
 */
import type { Metadata } from 'next'
import { getMediaUrl } from '@/lib/utils/media-utils'
import {
  DEFAULT_OG_IMAGES,
  DEFAULT_TITLE_TEMPLATE,
  NOINDEX_FOLLOW_ROBOTS,
  pageOpenGraph,
  trim,
} from '@/lib/utils/seo'
import { getSiteSeo } from '@/lib/utils/site-seo'
import type { SiteSeoPageKey } from '@/src/globals/SiteSeo'
import type { SiteSeo } from '@/src/payload-types'

/** The shared `seo` group. Hub pages (Site SEO) lack `canonicalPath`; beers, locations and jobs have it. */
export type SeoOverride =
  (NonNullable<SiteSeo['pages']>['home'] & { canonicalPath?: string | null }) | null | undefined

type OgImageList = NonNullable<NonNullable<Metadata['openGraph']>['images']>

/** Declares the upload's real dimensions when known; a wrong size makes scrapers crop or reject the card. */
function ogImageFromUpload(media: unknown): OgImageList | undefined {
  const url = getMediaUrl(media)
  if (!url) return undefined
  const { alt, width, height } = media as { alt?: unknown; width?: unknown; height?: unknown }
  return [
    {
      url,
      alt: typeof alt === 'string' ? alt : 'Lolev Beer',
      ...(typeof width === 'number' && typeof height === 'number' ? { width, height } : {}),
    },
  ]
}

/** Site default OG image: the CMS upload if set, else the bundled card. */
export function defaultOgImages(media?: unknown) {
  return ogImageFromUpload(media) ?? DEFAULT_OG_IMAGES
}

type BuildArgs = {
  /** Auto-generated title (without site suffix when using the layout template). */
  fallbackTitle: string
  fallbackDescription: string
  /** Canonical path, e.g. /beer or /beer/lupula */
  canonicalPath: string
  fallbackKeywords?: string[]
  /** Document SEO group (beer, location, job). */
  seo?: SeoOverride
  /** Hub page key in the Site SEO global; used when `seo` is not given. */
  hubKey?: SiteSeoPageKey
  /** Absolute or path OG images when the doc already has one (e.g. beer image) */
  fallbackOgImages?: NonNullable<Metadata['openGraph']>['images']
  /** Home only: the title is the whole <title>, so skip the layout's site-name template. */
  absoluteTitle?: boolean
}

/**
 * Build page Metadata from CMS overrides + code fallbacks.
 * Layout still owns title.template and site-wide twitter defaults.
 */
export async function buildPageMetadata({
  fallbackTitle,
  fallbackDescription,
  canonicalPath,
  fallbackKeywords = [],
  seo: docSeo,
  hubKey,
  fallbackOgImages,
  absoluteTitle = false,
}: BuildArgs): Promise<Metadata> {
  const siteSeo = await getSiteSeo()
  const seo: SeoOverride = docSeo ?? (hubKey ? siteSeo.pages?.[hubKey] : undefined)
  const title = trim(seo?.title) ?? fallbackTitle
  const description = trim(seo?.description) ?? fallbackDescription
  // Same template the layout applies to <title>, so og:title never drifts from it.
  const template = trim(siteSeo.titleTemplate) ?? DEFAULT_TITLE_TEMPLATE
  const ogTitle =
    trim(seo?.ogTitle) ?? (absoluteTitle ? title : template.replace('%s', () => title))
  const ogDescription = trim(seo?.ogDescription) ?? description
  const canonical = trim(seo?.canonicalPath) ?? canonicalPath

  const keywords = [
    ...(seo?.keywords?.filter((k): k is string => Boolean(k?.trim())) ?? []),
    ...fallbackKeywords,
  ]
  const uniqueKeywords = [...new Set(keywords)]

  const images =
    ogImageFromUpload(seo?.ogImage) ?? fallbackOgImages ?? defaultOgImages(siteSeo.ogImage)

  const metadata: Metadata = {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical },
    // Page openGraph replaces the layout's wholesale, so og:url must be restated here.
    openGraph: { ...pageOpenGraph(ogTitle, ogDescription, images), url: canonical },
  }

  if (uniqueKeywords.length) {
    metadata.keywords = uniqueKeywords
  }

  if (seo?.noIndex) {
    metadata.robots = NOINDEX_FOLLOW_ROBOTS
  }

  return metadata
}
