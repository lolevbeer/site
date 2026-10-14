/**
 * Open roles, scoped to a taproom. Anonymous REST/GraphQL read is active jobs
 * only; admins also see inactive openings. Saving an active opening publishes it immediately.
 */
import type { CollectionConfig, PayloadRequest } from 'payload'
import { revalidatePath } from 'next/cache'
import { adminAccess, hasRole } from '@/src/access/roles'
import { generateUniqueSlug } from './utils/generateUniqueSlug'
import { documentSeoField } from '@/src/fields/seo'

/**
 * Populated location slug, or a lookup when the field is still an id. The
 * lookup runs as the editor (`req`); locations are publicly readable.
 */
async function locationSlugForJob(
  location: unknown,
  req: PayloadRequest | undefined,
): Promise<string | undefined> {
  if (typeof location === 'object' && location && 'slug' in location) {
    return typeof location.slug === 'string' ? location.slug : undefined
  }
  if (!location || !req?.payload) return undefined
  const id =
    typeof location === 'object' && 'id' in location ? String(location.id) : String(location)
  try {
    const loc = await req.payload.findByID({
      collection: 'locations',
      id,
      depth: 0,
      req,
      overrideAccess: false,
    })
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
    group: 'Hiring',
    useAsTitle: 'title',
    defaultColumns: ['title', 'location', 'employmentType', 'active', 'closesOn'],
    description: 'Openings listed at /jobs (footer link). Applications land in Job Applications.',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Job title',
    },
    {
      type: 'row',
      fields: [
        {
          name: 'location',
          type: 'relationship',
          relationTo: 'locations',
          required: true,
          index: true,
          label: 'Taproom',
          admin: {
            width: '50%',
          },
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
          label: 'Employment type',
          admin: {
            width: '50%',
          },
        },
      ],
    },
    {
      name: 'summary',
      type: 'textarea',
      admin: { description: 'One or two lines on the taproom page.' },
      label: 'Short listing summary',
    },
    {
      name: 'description',
      type: 'textarea',
      required: true,
      label: 'Full job description',
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        position: 'sidebar',
        description:
          'Saving a published opening makes it visible immediately. Closing date alone does not unpublish it.',
      },
      label: 'Published on website',
    },
    {
      name: 'closesOn',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayOnly' },
        description:
          'Optional last day to apply. Sent to Google as the posting’s expiry. This does not hide the job: also uncheck Published on website when it closes.',
      },
      label: 'Application closing date',
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
      label: 'Page URL slug',
    },
    {
      type: 'collapsible',
      label: 'Search & sharing',
      admin: { initCollapsed: true },
      fields: [{ ...documentSeoField, admin: { ...documentSeoField.admin, position: undefined } }],
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, req, originalDoc }) => {
        if (!data.slug?.trim() && typeof data.title === 'string' && data.title) {
          const docId = originalDoc?.id || data.id
          data.slug = await generateUniqueSlug(data.title, 'jobs', req, docId)
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, req, context }) => {
        if (context?.skipRevalidate) return doc
        const slug = await locationSlugForJob(doc.location, req)
        if (slug) revalidatePath(`/${slug}`)
        return doc
      },
    ],
  },
  labels: { singular: 'Job Opening', plural: 'Job Openings' },
}
