import type { CollectionConfig } from 'payload'

export const Events: CollectionConfig = {
  slug: 'events',
  admin: {
    useAsTitle: 'vendor',
    defaultColumns: ['vendor', 'date', 'location', 'visibility'],
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
        description: 'Event or vendor name',
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
      admin: {
        description: 'Time range (e.g., "4-9pm" or "7:30pm")',
      },
    },
    {
      name: 'endTime',
      type: 'text',
      admin: {
        description: 'End time if different format needed',
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
      name: 'visibility',
      type: 'select',
      required: true,
      defaultValue: 'public',
      options: [
        { label: 'Public', value: 'public' },
        { label: 'Private', value: 'private' },
      ],
      index: true,
    },
    {
      name: 'site',
      type: 'text',
      admin: {
        description: 'Website or social media link',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Event description (optional)',
      },
    },
    {
      name: 'attendees',
      type: 'number',
      admin: {
        description: 'Expected or registered attendees',
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
