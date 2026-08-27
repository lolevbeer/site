import type { Access, CollectionConfig } from 'payload'
import { foodManagerAccess, hasRole } from '@/src/access/roles'
import { recurringDays, recurringOccurrences } from '@/src/utils/recurring-food'

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

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
      options: recurringDays.map((day) => ({ label: capitalize(day), value: day })),
      index: true,
    },
    {
      name: 'occurrence',
      type: 'select',
      required: true,
      options: recurringOccurrences.map((occurrence) => ({
        label: capitalize(occurrence),
        value: occurrence,
      })),
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
