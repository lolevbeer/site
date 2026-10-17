import type { CollectionConfig } from 'payload'
import { foodManagerAccess } from '@/src/access/roles'
import { readFood } from '@/src/access/schedules'

export const RecurringFoodExclusions: CollectionConfig = {
  slug: 'recurring-food-exclusions',
  labels: {
    singular: 'Recurring Food Exclusion',
    plural: 'Recurring Food Exclusions',
  },
  admin: {
    group: 'System',
    hidden: true,
    useAsTitle: 'date',
    defaultColumns: ['date', 'location', 'reason'],
    description:
      'Skipped location/date records managed through Recurring Food Schedule; not vendor-specific.',
  },
  access: {
    read: readFood,
    create: foodManagerAccess,
    update: foodManagerAccess,
    delete: foodManagerAccess,
  },
  indexes: [{ fields: ['location', 'date'], unique: true }],
  fields: [
    {
      name: 'location',
      type: 'relationship',
      relationTo: 'locations',
      required: true,
      index: true,
      label: 'Taproom',
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      index: true,
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
          displayFormat: 'MMM d, yyyy',
        },
      },
      label: 'Skipped food date',
    },
    {
      name: 'reason',
      type: 'text',
      label: 'Reason',
      admin: {
        description: 'Optional, publicly readable. Do not enter confidential notes.',
      },
    },
  ],
}
