import type { CollectionConfig, Access } from 'payload'

const isAdminOrEditor: Access = ({ req: { user } }) => {
  return user?.role === 'admin' || user?.role === 'editor'
}

export const Food: CollectionConfig = {
  slug: 'food',
  access: {
    read: () => true,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
  labels: {
    singular: 'Food',
    plural: 'Food',
  },
  admin: {
    useAsTitle: 'vendor',
    defaultColumns: ['vendor', 'date', 'location', 'time'],
    pagination: {
      defaultLimit: 100,
    },
  },
  fields: [
    {
      name: 'vendor',
      type: 'text',
      required: true,
      admin: {
        description: 'Food vendor name',
      },
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      index: true,
      admin: {
        date: {
          displayFormat: 'MMM d, yyyy',
        },
      },
    },
    {
      name: 'time',
      type: 'text',
      required: true,
      admin: {
        description: 'Service time (e.g., "4-9pm")',
      },
    },
    {
      name: 'location',
      type: 'relationship',
      relationTo: 'locations',
      required: true,
      hasMany: false,
    },
    {
      name: 'site',
      type: 'text',
      admin: {
        description: 'Website or social media link',
      },
    },
    {
      name: 'day',
      type: 'select',
      options: [
        { label: 'Monday', value: 'Monday' },
        { label: 'Tuesday', value: 'Tuesday' },
        { label: 'Wednesday', value: 'Wednesday' },
        { label: 'Thursday', value: 'Thursday' },
        { label: 'Friday', value: 'Friday' },
        { label: 'Saturday', value: 'Saturday' },
        { label: 'Sunday', value: 'Sunday' },
      ],
      admin: {
        description: 'Day of week',
      },
    },
    {
      name: 'start',
      type: 'text',
      admin: {
        description: 'Start time (e.g., "4pm")',
      },
    },
    {
      name: 'finish',
      type: 'text',
      admin: {
        description: 'End time (e.g., "9pm")',
      },
    },
    {
      name: 'week',
      type: 'number',
      admin: {
        description: 'Week number',
      },
    },
    {
      name: 'dayNumber',
      type: 'number',
      admin: {
        description: 'Day number (1-7)',
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
