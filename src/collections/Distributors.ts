import type { CollectionConfig, Access } from 'payload'

const isAdminOrEditor: Access = ({ req: { user } }) => {
  return user?.role === 'admin' || user?.role === 'editor'
}

export const Distributors: CollectionConfig = {
  slug: 'distributors',
  access: {
    read: () => true,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
  admin: {
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
      required: true,
      defaultValue: 'Retail',
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
      options: [
        { label: 'Pennsylvania', value: 'PA' },
        { label: 'New York', value: 'NY' },
        { label: 'Ohio', value: 'OH' },
        { label: 'West Virginia', value: 'WV' },
      ],
      index: true,
      admin: {
        description: 'Geographic region',
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
    {
      name: 'source',
      type: 'select',
      defaultValue: 'payload',
      options: [
        { label: 'Payload', value: 'payload' },
        { label: 'Google Sheets', value: 'google-sheets' },
      ],
      admin: {
        position: 'sidebar',
        description: 'Where this record originated',
      },
    },
  ],
}
