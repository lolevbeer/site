import type { CollectionConfig } from 'payload'
import { eventManagerAccess } from '@/src/access/roles'
import { readRecurringEvents } from '@/src/access/schedules'
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
    read: readRecurringEvents,
    create: eventManagerAccess,
    update: eventManagerAccess,
    delete: eventManagerAccess,
  },
  admin: {
    group: 'Food & Events',
    useAsTitle: 'organizer',
    defaultColumns: ['organizer', 'year', 'day', 'occurrences', 'location', 'active', 'visibility'],
    description:
      'Monthly series for one calendar year. A dated event with the same name, taproom and date replaces the entire generated occurrence.',
  },
  indexes: [{ fields: ['year', 'location', 'active'] }],
  fields: [
    {
      name: 'active',
      type: 'checkbox',
      required: true,
      defaultValue: true,
      index: true,
      admin: {
        position: 'sidebar',
        description: 'Uncheck to stop expanding this series into scheduled events.',
      },
      label: 'Generate occurrences',
    },
    visibilityField,
    organizerField,
    locationField,
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
          admin: { width: '33%', description: 'Applies only to this calendar year.' },
          label: 'Schedule year',
        },
        {
          name: 'day',
          label: 'Weekday',
          type: 'select',
          required: true,
          options: recurringDays.map((day) => ({ label: capitalizeName(day), value: day })),
          admin: { width: '33%' },
        },
        {
          name: 'occurrences',
          label: 'Occurrences in month',
          type: 'select',
          hasMany: true,
          required: true,
          options: recurringOccurrences.map((occurrence) => ({
            label: capitalizeName(occurrence),
            value: occurrence,
          })),
          admin: {
            width: '34%',
            description:
              'For example, first and third Tuesday. Fifth runs only in months with a fifth occurrence.',
          },
        },
      ],
    },
    timeRowField,
    {
      type: 'collapsible',
      label: 'Skipped dates',
      admin: { initCollapsed: true },
      fields: [
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
      ],
    },
    ...eventDetailFields,
  ],
}
