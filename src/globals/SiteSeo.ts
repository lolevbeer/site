/**
 * Site-wide SEO defaults and per-hub-page meta overrides.
 * Covers every static URL in src/app/sitemap.ts.
 */
import type { GlobalConfig } from 'payload'
import { adminAccess } from '@/src/access/roles'
import { hubSeoGroup } from '@/src/fields/seo'

/** Hub keys in the Pages tab. Keep in sync with STATIC_INFO_PAGES + home/beer/events/food. */
export const SITE_SEO_PAGE_KEYS = [
  'home',
  'beer',
  'events',
  'food',
  'beerMap',
  'donate',
  'jobs',
  'about',
  'faq',
  'accessibility',
  'privacy',
  'terms',
] as const

export type SiteSeoPageKey = (typeof SITE_SEO_PAGE_KEYS)[number]

const PAGE_LABELS: Record<SiteSeoPageKey, string> = {
  home: 'Home (/)',
  beer: 'Beer catalog (/beer)',
  events: 'Events (/events)',
  food: 'Food (/food)',
  beerMap: 'Beer map (/beer-map)',
  donate: 'Donations (/donate)',
  jobs: 'Jobs list (/jobs)',
  about: 'About (/about)',
  faq: 'FAQ (/faq)',
  accessibility: 'Accessibility (/accessibility)',
  privacy: 'Privacy (/privacy)',
  terms: 'Terms (/terms)',
}

export const SiteSeo: GlobalConfig = {
  slug: 'site-seo',
  label: 'SEO',
  admin: {
    group: 'Settings',
    description:
      'Default titles, descriptions, and social images. Per-page overrides for every static sitemap URL. Beer, location, and job pages use the SEO group on each document.',
  },
  access: {
    read: () => true,
    update: adminAccess,
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Site defaults',
          description: 'Used when a page leaves its SEO fields blank.',
          fields: [
            {
              name: 'defaultTitle',
              type: 'text',
              label: 'Default title',
              admin: {
                description:
                  'Homepage / fallback <title>. Example: Lolev Beer | Craft Brewery in Zelienople & Pittsburgh',
              },
            },
            {
              name: 'titleTemplate',
              type: 'text',
              label: 'Title template',
              admin: {
                description:
                  'Next.js title template with %s for the page title. Example: %s | Lolev Beer. Leave blank for "%s | Lolev Beer".',
              },
            },
            {
              name: 'description',
              type: 'textarea',
              label: 'Default meta description',
              maxLength: 320,
              admin: {
                rows: 3,
                description:
                  'Site-wide description when a page has none. Taproom names are still appended in code when this is blank.',
              },
            },
            {
              name: 'keywords',
              type: 'text',
              hasMany: true,
              label: 'Default keywords',
              admin: {
                description: 'Merged with location names on the root layout. Mostly legacy.',
              },
            },
            {
              name: 'ogImage',
              type: 'upload',
              relationTo: 'media',
              label: 'Default Open Graph image',
              admin: {
                description: 'Fallback social card (1200×630). Replaces /images/beer/og-image.jpg when set.',
              },
            },
            {
              name: 'twitterSite',
              type: 'text',
              label: 'Twitter / X site handle',
              admin: {
                description: 'e.g. @lolevbeer',
              },
            },
            {
              name: 'twitterCreator',
              type: 'text',
              label: 'Twitter / X creator handle',
              admin: {
                description: 'e.g. @lolevbeer',
              },
            },
          ],
        },
        {
          label: 'Pages',
          description: 'One group per static URL in the sitemap.',
          fields: [
            {
              name: 'pages',
              type: 'group',
              label: 'Hub pages',
              fields: SITE_SEO_PAGE_KEYS.map((key) => hubSeoGroup(key, PAGE_LABELS[key])),
            },
          ],
        },
      ],
    },
  ],
}

/** Path → SiteSeo pages key for hub routes. */
export const PATH_TO_SEO_PAGE: Record<string, SiteSeoPageKey> = {
  '/': 'home',
  '/beer': 'beer',
  '/events': 'events',
  '/food': 'food',
  '/beer-map': 'beerMap',
  '/donate': 'donate',
  '/jobs': 'jobs',
  '/about': 'about',
  '/faq': 'faq',
  '/accessibility': 'accessibility',
  '/privacy': 'privacy',
  '/terms': 'terms',
}
