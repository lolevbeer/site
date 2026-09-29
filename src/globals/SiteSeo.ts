/**
 * Site-wide SEO defaults and per-hub-page meta overrides.
 * Covers every static URL in src/app/sitemap.ts.
 */
import type { GlobalConfig } from 'payload'
import { adminAccess } from '@/src/access/roles'
import { hubSeoGroup } from '@/src/fields/seo'

/** Hub pages in the Pages tab, keyed by SiteSeo `pages.*` name. Keep in sync with STATIC_INFO_PAGES + home/beer/events/food. */
const PAGE_LABELS = {
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

export type SiteSeoPageKey = keyof typeof PAGE_LABELS

/** Hub pages whose component renders the `intro` field. */
export const INTRO_PAGE_KEYS = [
  'beer',
  'events',
  'food',
] as const satisfies readonly SiteSeoPageKey[]
const introKeys = new Set<string>(INTRO_PAGE_KEYS)

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
                description:
                  'Fallback social card (1200×630). Replaces /images/beer/og-image.jpg when set.',
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
              fields: Object.entries(PAGE_LABELS).map(([key, label]) =>
                hubSeoGroup(key, label, introKeys.has(key)),
              ),
            },
          ],
        },
      ],
    },
  ],
}
