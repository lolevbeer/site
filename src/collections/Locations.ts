import type { CollectionConfig, Access, Field, RelationshipField, Validate, Where } from 'payload'
import { WEEKDAYS } from '@/lib/types/location'
import { capitalizeName } from '@/lib/utils/formatters'
import { LOCATION_SLUG_PATTERN, RESERVED_LOCATION_SLUGS } from '@/lib/config/locations'
import { generateUniqueSlug } from './utils/generateUniqueSlug'
import { markLinesCleanedField } from './utils/markLinesCleanedField'
import { documentSeoField } from '@/src/fields/seo'
import {
  adminAccess,
  adminFieldAccess,
  getUserLocationIds,
  isAdmin,
  hasRole,
  leadBartenderFieldAccess,
} from '@/src/access/roles'

/**
 * Allow admins full access, lead-bartenders can update their assigned locations
 */
const canUpdateLocation: Access = ({ req: { user } }) => {
  if (isAdmin(user)) return true
  if (hasRole(user, 'lead-bartender')) {
    const locationIds = getUserLocationIds(user)
    if (locationIds.length > 0) {
      return {
        id: {
          in: locationIds,
        },
      }
    }
  }
  return false
}

/**
 * Aliases must be URL slugs that no route or other location already claims;
 * otherwise /<alias>, /e/<alias>, and ?loc=<alias> would be ambiguous or dead.
 * Only aliases added in this save are checked, so an existing one never blocks
 * an unrelated save (lead bartenders can't edit this field). Location slugs and
 * aliases are public, so the check reads as the editor.
 */
const validateAliases: Validate<string[]> = async (value, { id, previousValue, req }) => {
  const previous = new Set(previousValue ?? [])
  const added = (value ?? []).filter((alias) => !previous.has(alias))
  if (added.length === 0) return true
  const malformed = added.find((alias) => !LOCATION_SLUG_PATTERN.test(alias))
  if (malformed) return `"${malformed}" must be a lowercase slug (letters, numbers, dashes).`
  const reserved = added.find((alias) => RESERVED_LOCATION_SLUGS.has(alias))
  if (reserved) return `"${reserved}" is reserved by a site page and cannot be an alias.`

  const claimed: Where = {
    or: [{ slug: { in: added } }, { aliases: { in: added } }],
  }
  const others = await req.payload.find({
    collection: 'locations',
    where: id ? { and: [{ id: { not_equals: id } }, claimed] } : claimed,
    limit: 1,
    depth: 0,
    select: { name: true, slug: true, aliases: true },
    overrideAccess: false,
    req,
  })
  const other = others.docs[0]
  if (!other) return true
  const taken = added.find((alias) => alias === other.slug || other.aliases?.includes(alias))
  return `"${taken}" is already the slug or an alias of ${other.name}.`
}

/**
 * Record the previous slug as an alias when a rename changes it, so old
 * /<slug> links redirect and /e/<slug> TV boards keep rendering. Aliases never
 * include the current slug or a reserved route slug (those would not resolve).
 */
function withPreviousSlug(
  aliases: string[] | null | undefined,
  previousSlug: string | null | undefined,
  currentSlug: string | null | undefined,
): string[] {
  const next = [...(aliases ?? [])]
  if (previousSlug && !RESERVED_LOCATION_SLUGS.has(previousSlug)) next.push(previousSlug)
  return [...new Set(next)].filter((alias) => alias !== currentSlug)
}

/** Opening or closing time for one weekday. */
const timeField = (name: 'open' | 'close'): Field => ({
  name,
  type: 'date',
  admin: { width: '50%', date: { pickerAppearance: 'timeOnly', displayFormat: 'h:mm a' } },
})

export const Locations: CollectionConfig = {
  slug: 'locations',
  admin: {
    group: 'Taproom Operations',
    useAsTitle: 'name',
    defaultColumns: ['name', 'active', 'linesLastCleaned'],
  },
  access: {
    read: () => true, // Public read access
    create: adminAccess,
    update: canUpdateLocation,
    delete: adminAccess,
  },
  hooks: {
    beforeChange: [
      async ({ data, req, originalDoc }) => {
        // Field access gates this command; the server supplies the date so
        // lead bartenders can record today without choosing an arbitrary date.
        if (data.markLinesCleanedToday === true) {
          data.linesLastCleaned = new Date().toISOString()
        }
        delete data.markLinesCleanedToday

        // Compute slug from name — only when the name changed or no slug
        // exists yet, so unrelated saves skip the uniqueness queries.
        if (
          data.name &&
          typeof data.name === 'string' &&
          (data.name !== originalDoc?.name || !data.slug)
        ) {
          data.slug = await generateUniqueSlug(data.name, 'locations', req, originalDoc?.id, [
            'slug',
            'aliases',
          ])
        }

        const previousSlug = originalDoc?.slug
        const slugChanged = Boolean(previousSlug && data.slug && data.slug !== previousSlug)
        if (slugChanged || data.aliases) {
          data.aliases = withPreviousSlug(
            data.aliases ?? originalDoc?.aliases,
            slugChanged ? previousSlug : undefined,
            data.slug ?? previousSlug,
          )
        }

        return data
      },
    ],
  },
  fields: [
    {
      name: 'markLinesCleanedToday',
      type: 'checkbox',
      virtual: true,
      access: {
        create: leadBartenderFieldAccess,
        update: leadBartenderFieldAccess,
      },
      admin: { hidden: true },
    },
    {
      name: 'linesLastCleaned',
      type: 'date',
      label: 'Draft Lines Last Cleaned',
      access: {
        create: adminFieldAccess,
        update: adminFieldAccess,
      },
      admin: {
        position: 'sidebar',
        condition: (_data, _siblingData, { user }) => isAdmin(user),
        description: 'Admin correction: choose a date, then save this location.',
        date: {
          pickerAppearance: 'dayOnly',
          displayFormat: 'MMM d, yyyy',
        },
      },
    },
    markLinesCleanedField(),
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      access: {
        update: adminFieldAccess,
      },
      label: 'Taproom name',
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      access: {
        update: adminFieldAccess,
      },
      admin: {
        description: 'Is this location currently active?',
      },
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Hours & operations',
          fields: [
            {
              name: 'timezone',
              type: 'select',
              defaultValue: 'America/New_York',
              options: [
                { label: 'Eastern Time (EST/EDT)', value: 'America/New_York' },
                { label: 'Central Time (CST/CDT)', value: 'America/Chicago' },
                { label: 'Mountain Time (MST/MDT)', value: 'America/Denver' },
                { label: 'Pacific Time (PST/PDT)', value: 'America/Los_Angeles' },
              ],
              access: {
                update: adminFieldAccess,
              },
              admin: {
                description: "Timezone for this location's hours",
              },
            },
            {
              type: 'collapsible',
              label: 'Weekly opening hours',
              admin: { condition: (_data, _siblingData, { user }) => isAdmin(user) },
              // One named tab per day (not one tab bar) so all seven stack; paths stay monday.open etc.
              fields: WEEKDAYS.map((day): Field => ({
                type: 'tabs',
                tabs: [
                  {
                    name: day,
                    label: capitalizeName(day),
                    fields: [{ type: 'row', fields: [timeField('open'), timeField('close')] }],
                  },
                ],
              })),
            },
            {
              type: 'row',
              fields: (['draft', 'cans'] as const).map((type): RelationshipField => ({
                name: `${type}Menu`,
                label: type === 'draft' ? 'Draft Menu' : 'Cans Menu',
                type: 'relationship',
                relationTo: 'menus',
                // Avoid populating the location → menu → location cycle.
                maxDepth: 0,
                access: { update: adminFieldAccess },
                filterOptions: ({ id }) =>
                  id ? { location: { equals: id }, type: { equals: type } } : false,
                admin: {
                  width: '50%',
                  description:
                    `The ${type} menu shown for this location on the homepage and /<location> page ` +
                    '(e.g. /lawrenceville). Only published menus appear. Leave blank to hide it.',
                },
              })),
            },
          ],
        },
        {
          label: 'Visitor information',
          fields: [
            {
              name: 'basicInfo',
              type: 'group',
              label: 'Contact Information',
              access: {
                update: adminFieldAccess,
              },
              fields: [
                {
                  name: 'phone',
                  type: 'text',
                  label: 'Public phone',
                },
                {
                  name: 'email',
                  type: 'email',
                  label: 'Public email',
                },
              ],
            },
            {
              name: 'address',
              type: 'group',
              access: {
                update: adminFieldAccess,
              },
              fields: [
                {
                  name: 'street',
                  type: 'text',
                },
                {
                  name: 'city',
                  type: 'text',
                },
                {
                  name: 'state',
                  type: 'text',
                },
                {
                  name: 'zip',
                  type: 'text',
                  label: 'Postal code',
                },
                {
                  name: 'directionsUrl',
                  type: 'text',
                  label: 'Directions URL',
                  admin: {
                    description: 'Custom Google Maps or directions link for this location',
                  },
                },
              ],
            },
          ],
        },
        {
          label: 'Images & website',
          fields: [
            {
              name: 'intro',
              type: 'textarea',
              label: 'Location introduction',
              access: {
                update: adminFieldAccess,
              },
              admin: {
                rows: 3,
                description:
                  'Optional paragraph under the public location heading. Blank shows nothing.',
              },
            },
            {
              name: 'images',
              type: 'group',
              label: 'Location Images',
              access: {
                update: adminFieldAccess,
              },
              fields: [
                {
                  name: 'card',
                  type: 'upload',
                  relationTo: 'media',
                  admin: {
                    description: 'Image shown on location cards (recommended: 800x600px)',
                  },
                  label: 'Location card image',
                },
                {
                  name: 'hero',
                  type: 'upload',
                  relationTo: 'media',
                  admin: {
                    description: 'Hero/banner image for this location (recommended: 1920x1080px)',
                  },
                  label: 'Location banner image',
                },
              ],
            },
            {
              type: 'collapsible',
              label: 'URLs & map',
              admin: { initCollapsed: true },
              fields: [
                {
                  name: 'slug',
                  type: 'text',
                  // Hand-set slugs (REST/Local API) skip the generator; the slug is a redirect target.
                  validate: (value: string | null | undefined) =>
                    !value ||
                    LOCATION_SLUG_PATTERN.test(value) ||
                    'Slug must be lowercase letters, numbers, and dashes.',
                  admin: {
                    description: 'Auto-generated from name (lowercase, spaces to dashes)',
                    readOnly: true,
                  },
                  label: 'Page URL slug',
                },
                {
                  name: 'aliases',
                  type: 'text',
                  hasMany: true,
                  access: {
                    update: adminFieldAccess,
                  },
                  validate: validateAliases,
                  admin: {
                    description:
                      'Former slugs. /<alias> redirects to the current page and /e/<alias> still shows ' +
                      'the events board. A rename adds the old slug automatically. Browsers cache the ' +
                      'redirect, so a deleted alias can keep sending past visitors here; avoid reusing it ' +
                      "as another location's slug.",
                  },
                  label: 'Previous URL slugs',
                },
                {
                  name: 'coordinates',
                  type: 'point',
                  label: 'Map coordinates',
                  access: {
                    update: adminFieldAccess,
                  },
                  admin: {
                    description: 'Longitude, Latitude (e.g. -79.960098, 40.465372)',
                  },
                },
              ],
            },
            {
              type: 'collapsible',
              label: 'Search & sharing',
              admin: { initCollapsed: true },
              fields: [documentSeoField],
            },
          ],
        },
      ],
    },
  ],
}
