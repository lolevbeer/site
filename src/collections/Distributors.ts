import type { CollectionConfig } from 'payload'
import { adminAccess } from '@/src/access/roles'
import { CUSTOMER_TYPES, US_STATES } from '@/lib/distributors/fields'
import { isCountryCode } from '@/lib/distributors/country'

export const Distributors: CollectionConfig = {
  slug: 'distributors',
  access: {
    read: () => true,
    create: adminAccess,
    update: adminAccess,
    delete: adminAccess,
  },
  admin: {
    group: 'Website',
    useAsTitle: 'name',
    defaultColumns: ['name', 'city', 'country', 'customerType', 'active'],
    pagination: {
      defaultLimit: 100,
    },
    description:
      'Public beer-map locations. Bulk import in Tools > Sync > Distributor CSV; preview with Dry run first.',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Business or location name',
      },
      label: 'Business name',
    },
    {
      name: 'customerType',
      type: 'select',
      options: [...CUSTOMER_TYPES],
      index: true,
      admin: {
        description: 'Type of customer/location',
      },
      label: 'Customer type',
    },
    {
      name: 'country',
      type: 'text',
      index: true,
      // Enforced here, not only in the CSV parser, so admin edits obey it too
      validate: (value: string | null | undefined) =>
        !value || isCountryCode(value) || 'Country must be a two-letter ISO code, e.g. NL, JP, GB',
      admin: {
        description:
          'Two-letter ISO country code (e.g., NL, JP, GB). Leave blank for the United States.',
      },
      label: 'Country code',
    },
    {
      name: 'address',
      type: 'text',
      required: true,
      admin: {
        description: 'Full street address',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'city',
          type: 'text',
          admin: {
            description: 'City name',
          },
        },
        {
          name: 'state',
          type: 'text',
          admin: {
            description: 'US state abbreviation (e.g., PA, NY); free text outside the US',
          },
          label: 'State / province',
        },
        {
          name: 'zip',
          type: 'text',
          admin: {
            description: 'ZIP or postal code',
          },
          label: 'Postal code',
        },
      ],
    },
    {
      name: 'region',
      type: 'select',
      options: [...US_STATES],
      index: true,
      admin: {
        description:
          'US venues only: the state or DC. The CSV import defaults it to the state. Leave blank outside the US; those venues group by country.',
      },
      label: 'US directory state',
    },
    {
      type: 'row',
      fields: [
        {
          name: 'phone',
          type: 'text',
          admin: {
            description: 'Contact phone number',
          },
          label: 'Public phone',
        },
        {
          name: 'website',
          type: 'text',
          // Enforced here, not only in the CSV parser, so admin edits obey it too
          validate: (value: string | null | undefined) =>
            !value || /^https?:\/\//i.test(value) || 'Website must start with http:// or https://',
          admin: {
            description: 'Website URL, starting with http:// or https://',
          },
          label: 'Public website',
        },
      ],
    },
    {
      name: 'location',
      type: 'point',
      required: true,
      admin: {
        description: 'Geographic coordinates [longitude, latitude]',
      },
      label: 'Map coordinates',
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether this location is currently active',
        position: 'sidebar',
      },
      label: 'Show in directory',
    },
  ],
  labels: { singular: 'Stockist', plural: 'Stockists' },
}
