import type { CollectionConfig, Access, FieldAccess } from 'payload'
import { generateUniqueSlug } from './utils/generateUniqueSlug'
import { adminAccess, adminFieldAccess, isAdmin, hasRole } from '@/src/access/roles'

/**
 * Get location IDs from user's assigned locations
 */
function getUserLocationIds(user: any): string[] | null {
  if (!user?.locations || !Array.isArray(user.locations) || user.locations.length === 0) {
    return null
  }
  return user.locations.map((loc: any) => (typeof loc === 'object' ? loc.id : loc))
}

/**
 * Allow admins full access, bartenders can update their assigned locations
 */
const canUpdateLocation: Access = ({ req: { user } }) => {
  if (isAdmin(user)) return true
  if (hasRole(user, 'bartender')) {
    const locationIds = getUserLocationIds(user)
    if (locationIds) {
      return {
        id: {
          in: locationIds,
        },
      }
    }
  }
  return false
}

export const Locations: CollectionConfig = {
  slug: 'locations',
  admin: {
    group: 'Settings',
    useAsTitle: 'name',
    hideAPIURL: true,
  },
  access: {
    read: () => true, // Public read access
    create: adminAccess,
    update: canUpdateLocation,
    delete: adminAccess,
  },
  hooks: {
    beforeChange: [
      async ({ data, req, operation, originalDoc }) => {
        // Compute slug from name
        if (data.name && typeof data.name === 'string') {
          data.slug = await generateUniqueSlug(
            data.name,
            'locations',
            req,
            operation,
            originalDoc?.id,
          )
        }

        return data
      },
    ],
  },
  fields: [
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
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      access: {
        update: adminFieldAccess,
      },
    },
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
        description: 'Timezone for this location\'s hours',
      },
    },
    {
      name: 'slug',
      type: 'text',
      admin: {
        description: 'Auto-generated from name (lowercase, spaces to dashes)',
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'googleSheets',
      type: 'group',
      label: 'Google Sheets Import URLs',
      access: {
        update: adminFieldAccess,
      },
      admin: {
        description: 'CSV export URLs for syncing data from Google Sheets',
      },
      fields: [
        {
          name: 'eventsPublic',
          type: 'text',
          label: 'Events Sheet (Public)',
          admin: {
            description: 'Public events (concerts, trivia, etc.)',
          },
        },
        {
          name: 'eventsPrivate',
          type: 'text',
          label: 'Events Sheet (Private)',
          admin: {
            description: 'Private events (rentals, corporate, etc.)',
          },
        },
        {
          name: 'food',
          type: 'text',
          label: 'Food Sheet',
          admin: {
            description: 'Food truck schedule',
          },
        },
        {
          name: 'hours',
          type: 'text',
          label: 'Hours Sheet',
          admin: {
            description: 'Operating hours schedule',
          },
        },
      ],
    },
    {
      name: 'basicInfo',
      type: 'group',
      label: 'Contact Information',
      access: {
        update: adminFieldAccess,
      },
      admin: {
        position: 'sidebar',
      },
      fields: [
        {
          name: 'phone',
          type: 'text',
        },
        {
          name: 'email',
          type: 'email',
        },
      ],
    },
    {
      name: 'address',
      type: 'group',
      access: {
        update: adminFieldAccess,
      },
      admin: {
        position: 'sidebar',
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
    {
      name: 'coordinates',
      type: 'point',
      label: 'Coordinates',
      access: {
        update: adminFieldAccess,
      },
      admin: {
        position: 'sidebar',
        description: 'Longitude, Latitude (e.g. -79.960098, 40.465372)',
      },
    },
    {
      name: 'linesLastCleaned',
      type: 'date',
      label: 'Draft Lines Last Cleaned',
      admin: {
        description: 'Date when draft lines were last cleaned',
        date: {
          pickerAppearance: 'dayOnly',
          displayFormat: 'MMM d, yyyy',
        },
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
        },
        {
          name: 'hero',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description: 'Hero/banner image for this location (recommended: 1920x1080px)',
          },
        },
      ],
    },
    {
      type: 'tabs',
      admin: {
        condition: (data, siblingData, { user }) => isAdmin(user),
      },
      tabs: [
        {
          name: 'monday',
          label: 'Monday',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'open',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: {
                      pickerAppearance: 'timeOnly',
                      displayFormat: 'h:mm a',
                    },
                  },
                },
                {
                  name: 'close',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: {
                      pickerAppearance: 'timeOnly',
                      displayFormat: 'h:mm a',
                    },
                  },
                },
              ],
            },
          ],
        },
        {
          name: 'tuesday',
          label: 'Tuesday',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'open',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: {
                      pickerAppearance: 'timeOnly',
                      displayFormat: 'h:mm a',
                    },
                  },
                },
                {
                  name: 'close',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: {
                      pickerAppearance: 'timeOnly',
                      displayFormat: 'h:mm a',
                    },
                  },
                },
              ],
            },
          ],
        },
        {
          name: 'wednesday',
          label: 'Wednesday',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'open',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: {
                      pickerAppearance: 'timeOnly',
                      displayFormat: 'h:mm a',
                    },
                  },
                },
                {
                  name: 'close',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: {
                      pickerAppearance: 'timeOnly',
                      displayFormat: 'h:mm a',
                    },
                  },
                },
              ],
            },
          ],
        },
        {
          name: 'thursday',
          label: 'Thursday',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'open',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: {
                      pickerAppearance: 'timeOnly',
                      displayFormat: 'h:mm a',
                    },
                  },
                },
                {
                  name: 'close',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: {
                      pickerAppearance: 'timeOnly',
                      displayFormat: 'h:mm a',
                    },
                  },
                },
              ],
            },
          ],
        },
        {
          name: 'friday',
          label: 'Friday',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'open',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: {
                      pickerAppearance: 'timeOnly',
                      displayFormat: 'h:mm a',
                    },
                  },
                },
                {
                  name: 'close',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: {
                      pickerAppearance: 'timeOnly',
                      displayFormat: 'h:mm a',
                    },
                  },
                },
              ],
            },
          ],
        },
        {
          name: 'saturday',
          label: 'Saturday',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'open',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: {
                      pickerAppearance: 'timeOnly',
                      displayFormat: 'h:mm a',
                    },
                  },
                },
                {
                  name: 'close',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: {
                      pickerAppearance: 'timeOnly',
                      displayFormat: 'h:mm a',
                    },
                  },
                },
              ],
            },
          ],
        },
        {
          name: 'sunday',
          label: 'Sunday',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'open',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: {
                      pickerAppearance: 'timeOnly',
                      displayFormat: 'h:mm a',
                    },
                  },
                },
                {
                  name: 'close',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: {
                      pickerAppearance: 'timeOnly',
                      displayFormat: 'h:mm a',
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
