/**
 * Open roles, scoped to a taproom. Anonymous REST/GraphQL read is active jobs
 * only; admins see drafts and inactive openings.
 */
import type { CollectionConfig, Payload } from 'payload'
import { revalidatePath } from 'next/cache'
import { adminAccess, hasRole } from '@/src/access/roles'
import { generateUniqueSlug } from './utils/generateUniqueSlug'

/** Populated location slug, or a lookup when the field is still an id. */
async function locationSlugForJob(
  location: unknown,
  payload: Payload | undefined,
): Promise<string | undefined> {
  if (typeof location === 'object' && location && 'slug' in location) {
    return typeof location.slug === 'string' ? location.slug : undefined
  }
  if (!location || !payload) return undefined
  const id =
    typeof location === 'object' && 'id' in location ? String(location.id) : String(location)
  try {
    const loc = await payload.findByID({ collection: 'locations', id, depth: 0 })
    return loc?.slug || undefined
  } catch {
    return undefined
  }
}

export const Jobs: CollectionConfig = {
  slug: 'jobs',
  access: {
    read: ({ req: { user } }) => {
      if (hasRole(user, 'admin')) return true
      return { active: { equals: true } }
    },
    create: adminAccess,
    update: adminAccess,
    delete: adminAccess,
  },
  admin: {
    group: 'Settings',
    useAsTitle: 'title',
    hideAPIURL: true,
    defaultColumns: ['title', 'location', 'active', 'updatedAt'],
    description: 'Openings listed at /jobs (footer link). Applications land in Job Applications.',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        description: 'Auto-generated from the title if left blank.',
        position: 'sidebar',
      },
    },
    {
      name: 'location',
      type: 'relationship',
      relationTo: 'locations',
      required: true,
      index: true,
    },
    {
      name: 'employmentType',
      type: 'select',
      defaultValue: 'full-time',
      options: [
        { label: 'Full-time', value: 'full-time' },
        { label: 'Part-time', value: 'part-time' },
        { label: 'Seasonal', value: 'seasonal' },
      ],
    },
    {
      name: 'summary',
      type: 'textarea',
      admin: { description: 'One or two lines on the taproom page.' },
    },
    {
      name: 'description',
      type: 'textarea',
      required: true,
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: { position: 'sidebar' },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, req, operation, originalDoc }) => {
        if (!data.slug?.trim() && typeof data.title === 'string' && data.title) {
          const docId = originalDoc?.id || data.id
          data.slug = await generateUniqueSlug(data.title, 'jobs', req, operation, docId)
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, req, context }) => {
        if (context?.skipRevalidate) return doc
        const slug = await locationSlugForJob(doc.location, req?.payload)
        if (slug) revalidatePath(`/${slug}`)
        return doc
      },
    ],
  },
}
