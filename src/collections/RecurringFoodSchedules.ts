import type { Access, CollectionConfig } from 'payload'
import { foodManagerAccess, hasRole } from '@/src/access/roles'
import {
  RECURRING_YEAR_MAX,
  RECURRING_YEAR_MIN,
  recurringDays,
  recurringOccurrences,
} from '@/src/utils/recurring-food'
import { capitalizeName } from '@/lib/utils/formatters'

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
    // A text field: a relationship title would show the vendor's ID, not its name.
    useAsTitle: 'day',
    defaultColumns: ['vendor', 'location', 'year', 'day', 'occurrence', 'active'],
    description: 'Backing records for Recurring Food Schedule. Use the grid for routine changes.',
  },
  access: {
    read: canReadRecurringSchedules,
    create: foodManagerAccess,
    update: foodManagerAccess,
    delete: foodManagerAccess,
  },
  indexes: [{ fields: ['location', 'year', 'day', 'occurrence'], unique: true }],
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
      name: 'year',
      type: 'number',
      required: true,
      min: RECURRING_YEAR_MIN,
      max: RECURRING_YEAR_MAX,
      index: true,
      label: 'Schedule year',
    },
    {
      type: 'row',
      fields: [
        {
          name: 'day',
          type: 'select',
          required: true,
          options: recurringDays.map((day) => ({ label: capitalizeName(day), value: day })),
          index: true,
          label: 'Weekday',
        },
        {
          name: 'occurrence',
          type: 'select',
          required: true,
          options: recurringOccurrences.map((occurrence) => ({
            label: capitalizeName(occurrence),
            value: occurrence,
          })),
          index: true,
          label: 'Occurrence in month',
        },
      ],
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
