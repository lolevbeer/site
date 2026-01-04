import type { CollectionConfig } from 'payload'
import { adminAccess } from '@/src/access/roles'

export const Distributors: CollectionConfig = {
  slug: 'distributors',
  access: {
    read: () => true,
    create: adminAccess,
    update: adminAccess,
    delete: adminAccess,
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
        { label: 'New York', value: 'NY' },
        { label: 'Ohio', value: 'OH' },
        { label: 'Pennsylvania', value: 'PA' },
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
  ],
}
