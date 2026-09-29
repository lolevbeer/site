/**
 * Shared SEO field group for globals and collections.
 * Empty fields mean "use the code fallback" so existing pages keep working.
 */
import type { Field, GroupField } from 'payload'

const seoInnerFields = (options?: { includeCanonical?: boolean }): Field[] => {
  const fields: Field[] = [
    {
      name: 'title',
      type: 'text',
      label: 'Meta title',
      admin: {
        description:
          'Browser tab and SERP title. Leave blank to keep the auto-generated title. Do not append "| Lolev Beer" on hub pages; the site title template adds it.',
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
        description: 'Optional social share image (1200×630 recommended). Falls back to the site default.',
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
        description: 'Ask search engines not to index this page.',
      },
    },
  ]

  if (options?.includeCanonical !== false) {
    fields.push({
      name: 'canonicalPath',
      type: 'text',
      label: 'Canonical path',
      admin: {
        description:
          'Optional override, e.g. /beer or /lawrenceville. Must start with /. Leave blank for the normal URL.',
      },
    })
  }

  return fields
}

export type SeoGroupOptions = {
  /** Field name (default `seo`). */
  name?: string
  label?: string
  /** Put the group in the admin sidebar (collections). */
  sidebar?: boolean
  /** Include canonical path override (default true). */
  includeCanonical?: boolean
  description?: string
}

/** Reusable SEO group for collections and nested page groups. */
export function seoGroup(options: SeoGroupOptions = {}): GroupField {
  const {
    name = 'seo',
    label = 'SEO',
    sidebar = false,
    includeCanonical = true,
    description = 'Overrides for search and social. Blank fields keep the site defaults.',
  } = options

  return {
    name,
    type: 'group',
    label,
    admin: {
      ...(sidebar ? { position: 'sidebar' as const } : {}),
      description,
    },
    fields: seoInnerFields({ includeCanonical }),
  }
}

/** Hub-page SEO group without canonical (path is fixed per page key). */
export function hubSeoGroup(name: string, label: string): GroupField {
  return seoGroup({
    name,
    label,
    includeCanonical: false,
    description: `Meta for ${label}. Blank fields keep the code defaults.`,
  })
}

/** Sidebar SEO group for collections with public document URLs. */
export const documentSeoField = seoGroup({
  sidebar: true,
  description:
    'Optional overrides for this document’s public page. Blank fields keep the auto-generated title and description.',
})
