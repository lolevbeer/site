/**
 * Shared SEO field group for globals and collections.
 * Empty fields mean "use the code fallback" so existing pages keep working.
 */
import type { Field, GroupField, TextField } from 'payload'

const seoFields: Field[] = [
  {
    name: 'title',
    type: 'text',
    label: 'Meta title',
    admin: {
      description:
        'Browser tab and SERP title. Leave blank to keep the auto-generated title. Do not append "• Lolev Beer" on hub pages; the site title template adds it.',
    },
  },
  {
    name: 'description',
    type: 'textarea',
    label: 'Meta description',
    maxLength: 320,
    admin: {
      rows: 3,
      description: 'SERP snippet. Aim for ~150–160 characters.',
    },
  },
  {
    name: 'ogTitle',
    type: 'text',
    label: 'Open Graph title',
    admin: {
      description: 'Optional. Defaults to the meta title (plus site name where applicable).',
    },
  },
  {
    name: 'ogDescription',
    type: 'textarea',
    label: 'Open Graph description',
    maxLength: 320,
    admin: {
      rows: 2,
      description: 'Optional. Defaults to the meta description.',
    },
  },
  {
    name: 'ogImage',
    type: 'upload',
    relationTo: 'media',
    label: 'Open Graph image',
    admin: {
      description:
        'Optional social share image (1200×630 recommended). Falls back to the site default.',
    },
  },
  {
    name: 'keywords',
    type: 'text',
    hasMany: true,
    label: 'Keywords',
    admin: {
      description: 'Optional. Press Enter after each keyword. Mostly legacy; Google ignores these.',
    },
  },
  {
    name: 'noIndex',
    type: 'checkbox',
    label: 'Noindex',
    defaultValue: false,
    admin: {
      description:
        'Ask search engines not to list this page in results. Links on it are still followed, and it is left out of the sitemap.',
    },
  },
]

/** Canonical override; hub pages omit it because their path is fixed. */
const canonicalPathField: TextField = {
  name: 'canonicalPath',
  type: 'text',
  label: 'Canonical path',
  // A relative or full-URL value would emit a wrong canonical, and the sitemap drops any page
  // whose canonical differs from its own path, so reject malformed values at save time.
  validate: (value: string | null | undefined) => {
    const path = value?.trim()
    if (!path) return true
    if (!/^\/(?!\/)[^\s?#]*$/.test(path) || (path.length > 1 && path.endsWith('/'))) {
      return 'Use a path like /beer/lupula: start with a single /, no spaces, query, or trailing slash.'
    }
    return true
  },
  admin: {
    description:
      'Optional override, e.g. /beer or /lawrenceville. Must start with /. Leave blank for the normal URL.',
  },
}

/** Hub-page body copy shown under the page heading; blank shows nothing. */
const introField: Field = {
  name: 'intro',
  type: 'textarea',
  label: 'Intro text',
  admin: {
    rows: 3,
    description:
      'Optional short paragraph shown under the page heading (Beer, Events, Food). Good for search and AI answers; leave blank to show nothing.',
  },
}

function seoGroup(
  name: string,
  label: string,
  description: string,
  { sidebar = false, extraFields = [] as Field[] } = {},
): GroupField {
  return {
    name,
    type: 'group',
    label,
    admin: { ...(sidebar ? { position: 'sidebar' as const } : {}), description },
    fields: [...seoFields, ...extraFields],
  }
}

/** Hub-page SEO group: no canonical (path is fixed per page key); `withIntro` adds the intro paragraph. */
export const hubSeoGroup = (name: string, label: string, withIntro = false): GroupField =>
  seoGroup(name, label, `Meta for ${label}. Blank fields keep the code defaults.`, {
    extraFields: withIntro ? [introField] : [],
  })

/** Sidebar SEO group for collections with public document URLs. */
export const documentSeoField = seoGroup(
  'seo',
  'SEO',
  'Optional overrides for this document’s public page. Blank fields keep the auto-generated title and description.',
  { sidebar: true, extraFields: [canonicalPathField] },
)
