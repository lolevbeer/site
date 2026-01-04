import type { CollectionConfig } from 'payload'
import { adminAccess } from '@/src/access/roles'

export const HolidayHours: CollectionConfig = {
  slug: 'holiday-hours',
  labels: {
    singular: 'Holiday Hours',
    plural: 'Holiday Hours',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'locations', 'date', 'type'],
    group: 'Settings',
    description: 'Holiday and special hours overrides for locations',
  },
  access: {
    read: () => true,
    create: adminAccess,
    update: adminAccess,
    delete: adminAccess,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Name for this override (e.g., "Christmas Day", "New Year\'s Eve")',
      },
    },
    {
      name: 'locations',
      type: 'relationship',
      relationTo: 'locations',
      hasMany: true,
      required: true,
      admin: {
        description: 'Which location(s) this override applies to',
      },
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
          displayFormat: 'MMM d, yyyy',
        },
        description: 'The date this override applies to',
      },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'closed',
      options: [
        { label: 'Closed', value: 'closed' },
        { label: 'Modified Hours', value: 'modified' },
      ],
      admin: {
        description: 'Type of override',
      },
    },
    {
      name: 'hours',
      type: 'group',
      admin: {
        condition: (data) => data?.type === 'modified',
        description: 'Override hours (only used when type is "Modified Hours")',
      },
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
                description: 'Opening time',
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
                description: 'Closing time',
              },
            },
          ],
        },
      ],
    },
    {
      name: 'note',
      type: 'textarea',
      admin: {
        description: 'Optional note to display (e.g., "Closed for the holiday")',
      },
    },
  ],
}
