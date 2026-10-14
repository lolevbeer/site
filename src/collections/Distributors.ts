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
    group: 'Settings',
    useAsTitle: 'name',
    defaultColumns: ['name', 'address', 'customerType', 'region'],
    pagination: {
      defaultLimit: 100,
    },
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Business or location name',
      },
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
    },
    {
      name: 'zip',
      type: 'text',
      admin: {
        description: 'ZIP or postal code',
      },
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
    },
    {
      name: 'customerType',
      type: 'select',
      options: [...CUSTOMER_TYPES],
      index: true,
      admin: {
        description: 'Type of customer/location',
      },
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
    },
    {
      name: 'location',
      type: 'point',
      required: true,
      admin: {
        description: 'Geographic coordinates [longitude, latitude]',
      },
    },
    {
      name: 'phone',
      type: 'text',
      admin: {
        description: 'Contact phone number',
      },
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
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether this location is currently active',
        position: 'sidebar',
      },
    },
  ],
}
