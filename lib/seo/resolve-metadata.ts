/**
 * Merge CMS SEO overrides with code fallbacks into Next.js Metadata.
 */
import type { Metadata } from 'next'
import { getMediaUrl } from '@/lib/utils/media-utils'
import {
  DEFAULT_OG_IMAGES,
  DEFAULT_OG_IMAGE_PATH,
  pageOpenGraph,
} from '@/lib/utils/seo'

/** Shape of the shared `seo` group (collections + hub pages). */
export type SeoOverride = {
  title?: string | null
  description?: string | null
  ogTitle?: string | null
  ogDescription?: string | null
  ogImage?: unknown
  keywords?: string[] | null
  canonicalPath?: string | null
  noIndex?: boolean | null
} | null | undefined

export type SiteSeoDefaults = {
  defaultTitle?: string | null
  titleTemplate?: string | null
  description?: string | null
  keywords?: string[] | null
  ogImage?: unknown
  twitterSite?: string | null
  twitterCreator?: string | null
  pages?: Partial<Record<string, SeoOverride>> | null
} | null | undefined

function trim(value: string | null | undefined): string | undefined {
  const t = value?.trim()
  return t ? t : undefined
}

type OgImageList = NonNullable<NonNullable<Metadata['openGraph']>['images']>

function ogImageFromUpload(media: unknown): OgImageList | undefined {
  const url = getMediaUrl(media)
  if (!url) return undefined
  const alt =
    typeof media === 'object' && media && 'alt' in media && typeof (media as { alt?: unknown }).alt === 'string'
      ? (media as { alt: string }).alt
      : 'Lolev Beer'
  return [{ url, width: 1200, height: 630, alt }]
}

export function defaultOgImages(siteSeo?: SiteSeoDefaults) {
  return ogImageFromUpload(siteSeo?.ogImage) ?? DEFAULT_OG_IMAGES
}

export function defaultOgImagePath(siteSeo?: SiteSeoDefaults): string {
  return getMediaUrl(siteSeo?.ogImage) ?? DEFAULT_OG_IMAGE_PATH
}

type BuildArgs = {
  /** Auto-generated title (without site suffix when using the layout template). */
  fallbackTitle: string
  fallbackDescription: string
  /** Canonical path, e.g. /beer or /beer/lupula */
  canonicalPath: string
  fallbackKeywords?: string[]
  /** Document or hub-page SEO group */
  seo?: SeoOverride
  /** Site-wide defaults (for OG image / keyword merge) */
  siteSeo?: SiteSeoDefaults
  /** Absolute or path OG images when the doc already has one (e.g. beer image) */
  fallbackOgImages?: NonNullable<Metadata['openGraph']>['images']
  /** When true, title is used as-is for OG (already includes branding). */
  ogTitleAbsolute?: string
}

/**
 * Build page Metadata from CMS overrides + code fallbacks.
 * Layout still owns title.template and site-wide twitter defaults.
 */
export function buildPageMetadata({
  fallbackTitle,
  fallbackDescription,
  canonicalPath,
  fallbackKeywords = [],
  seo,
  siteSeo,
  fallbackOgImages,
  ogTitleAbsolute,
}: BuildArgs): Metadata {
  const title = trim(seo?.title) ?? fallbackTitle
  const description = trim(seo?.description) ?? fallbackDescription
  const ogTitle =
    trim(seo?.ogTitle) ?? ogTitleAbsolute ?? `${title} | Lolev Beer`
  const ogDescription = trim(seo?.ogDescription) ?? description
  const canonical = trim(seo?.canonicalPath) ?? canonicalPath

  const keywords = [
    ...(seo?.keywords?.filter((k): k is string => Boolean(k?.trim())) ?? []),
    ...fallbackKeywords,
  ]
  const uniqueKeywords = [...new Set(keywords)]

  const images =
    ogImageFromUpload(seo?.ogImage) ??
    fallbackOgImages ??
    defaultOgImages(siteSeo)

  const metadata: Metadata = {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      type: 'website',
      images,
    },
  }

  if (uniqueKeywords.length) {
    metadata.keywords = uniqueKeywords
  }

  if (seo?.noIndex) {
    metadata.robots = { index: false, follow: false }
  }

  return metadata
}

/** Convenience for static pages that previously used pageOpenGraph(). */
export function buildHubMetadata(
  path: string,
  fallbackTitle: string,
  fallbackDescription: string,
  hubSeo: SeoOverride,
  siteSeo?: SiteSeoDefaults,
  fallbackKeywords?: string[],
): Metadata {
  return buildPageMetadata({
    fallbackTitle,
    fallbackDescription,
    canonicalPath: path,
    fallbackKeywords,
    seo: hubSeo,
    siteSeo,
    ogTitleAbsolute: undefined,
  })
}

export { pageOpenGraph }
