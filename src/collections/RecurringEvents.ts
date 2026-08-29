import type { Access, CollectionConfig } from 'payload'
import { eventManagerAccess, hasRole } from '@/src/access/roles'
import {
  RECURRING_YEAR_MAX,
  RECURRING_YEAR_MIN,
  recurringDays,
  recurringOccurrences,
} from '@/src/utils/recurring-food'
import { capitalizeName } from '@/lib/utils/formatters'
import {
  eventDetailFields,
  locationField,
  organizerField,
  timeRowField,
  visibilityField,
} from '@/src/collections/shared/event-fields'

const canReadRecurringEvents: Access = ({ req: { user } }) => {
  if (hasRole(user, ['admin', 'event-manager'])) return true
  return { active: { equals: true }, visibility: { equals: 'public' } }
}

/**
 * Date-less event definitions. A document describes one recurring monthly
 * pattern for one calendar year; public reads expand it into concrete events.
 */
export const RecurringEvents: CollectionConfig = {
  slug: 'recurring-events',
  labels: {
    singular: 'Recurring Event',
    plural: 'Recurring Events',
  },
  access: {
    read: canReadRecurringEvents,
    create: eventManagerAccess,
    update: eventManagerAccess,
    delete: eventManagerAccess,
  },
  admin: {
    group: 'Food & Events',
    useAsTitle: 'organizer',
    hideAPIURL: true,
    defaultColumns: ['organizer', 'year', 'day', 'occurrences', 'location', 'visibility'],
    description:
      'Manage events that repeat monthly without creating a dated event for every occurrence.',
  },
  indexes: [{ fields: ['year', 'location', 'active'] }],
  fields: [
    {
      name: 'active',
      type: 'checkbox',
      required: true,
      defaultValue: true,
      index: true,
      admin: { position: 'sidebar' },
    },
    visibilityField,
    organizerField,
    {
      type: 'row',
      fields: [
        {
          name: 'year',
          type: 'number',
          required: true,
          defaultValue: () => new Date().getFullYear(),
          min: RECURRING_YEAR_MIN,
          max: RECURRING_YEAR_MAX,
          index: true,
          admin: { width: '33%' },
        },
        {
          name: 'day',
          label: 'Day of week',
          type: 'select',
          required: true,
          options: recurringDays.map((day) => ({ label: capitalizeName(day), value: day })),
          admin: { width: '33%' },
        },
        {
          name: 'occurrences',
          label: 'Weeks of month',
          type: 'select',
          hasMany: true,
          required: true,
          options: recurringOccurrences.map((occurrence) => ({
            label: capitalizeName(occurrence),
            value: occurrence,
          })),
          admin: {
            width: '34%',
            description: 'Choose one or more, such as first and third.',
          },
        },
      ],
    },
    locationField,
    timeRowField,
    {
      name: 'excludedDates',
      label: 'Skipped dates',
      type: 'array',
      admin: {
        description: 'Optional dates in this year when the recurring event will not happen.',
      },
      fields: [
        {
          name: 'date',
          type: 'date',
          required: true,
          admin: {
            date: { pickerAppearance: 'dayOnly', displayFormat: 'MMM d, yyyy' },
          },
        },
      ],
    },
    ...eventDetailFields,
  ],
}
