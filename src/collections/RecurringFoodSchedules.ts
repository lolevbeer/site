import type { Access, CollectionConfig } from 'payload'
import { foodManagerAccess, hasRole } from '@/src/access/roles'

const canReadRecurringSchedules: Access = ({ req: { user } }) => {
  if (hasRole(user, ['admin', 'food-manager'])) return true
  return { active: { equals: true } }
}

export const RecurringFoodSchedules: CollectionConfig = {
  slug: 'recurring-food-schedules',
  labels: {
    singular: 'Recurring Food Schedule',
    plural: 'Recurring Food Schedules',
  },
  admin: {
    group: 'System',
    hidden: true,
    useAsTitle: 'day',
    hideAPIURL: true,
    defaultColumns: ['location', 'day', 'occurrence', 'vendor', 'active'],
  },
  access: {
    read: canReadRecurringSchedules,
    create: foodManagerAccess,
    update: foodManagerAccess,
    delete: foodManagerAccess,
  },
  indexes: [{ fields: ['location', 'day', 'occurrence'], unique: true }],
  fields: [
    {
      name: 'location',
      type: 'relationship',
      relationTo: 'locations',
      required: true,
      index: true,
    },
    {
      name: 'vendor',
      type: 'relationship',
      relationTo: 'food-vendors',
      required: true,
      index: true,
      admin: {
        sortOptions: 'name',
      },
    },
    {
      name: 'day',
      type: 'select',
      required: true,
      options: [
        { label: 'Sunday', value: 'sunday' },
        { label: 'Monday', value: 'monday' },
        { label: 'Tuesday', value: 'tuesday' },
        { label: 'Wednesday', value: 'wednesday' },
        { label: 'Thursday', value: 'thursday' },
        { label: 'Friday', value: 'friday' },
        { label: 'Saturday', value: 'saturday' },
      ],
      index: true,
    },
    {
      name: 'occurrence',
      type: 'select',
      required: true,
      options: [
        { label: 'First', value: 'first' },
        { label: 'Second', value: 'second' },
        { label: 'Third', value: 'third' },
        { label: 'Fourth', value: 'fourth' },
        { label: 'Fifth', value: 'fifth' },
      ],
      index: true,
    },
    {
      name: 'active',
      type: 'checkbox',
      required: true,
      defaultValue: true,
      index: true,
      admin: {
        position: 'sidebar',
      },
    },
  ],
}
