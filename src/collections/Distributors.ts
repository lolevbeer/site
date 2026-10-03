import type { CollectionConfig } from 'payload'
import { adminAccess } from '@/src/access/roles'
import { US_STATES } from '@/lib/distributors/states'

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
        description: 'State abbreviation (e.g., PA, NY)',
      },
    },
    {
      name: 'zip',
      type: 'text',
      admin: {
        description: 'ZIP code',
      },
    },
    {
      name: 'customerType',
      type: 'select',
      options: [
        { label: 'Retail', value: 'Retail' },
        { label: 'On Premise', value: 'On Premise' },
        { label: 'Home Delivery', value: 'Home-D' },
      ],
      index: true,
      admin: {
        description: 'Type of customer/location',
      },
    },
    {
      name: 'region',
      type: 'select',
      defaultValue: 'PA',
      options: US_STATES.map(({ code, name }) => ({ label: name, value: code })),
      index: true,
      admin: {
        description:
          'Geographic region (a US state or DC); the CSV import defaults it to the state',
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
      admin: {
        description: 'Website URL',
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
