import type { CollectionConfig } from 'payload'
import { foodManagerAccess } from '@/src/access/roles'

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
    hideAPIURL: true,
    defaultColumns: ['date', 'location', 'reason'],
  },
  access: {
    read: () => true,
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
    },
    {
      name: 'reason',
      type: 'text',
    },
  ],
}
