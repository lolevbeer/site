import type { Access, CollectionConfig } from 'payload'
import { eventManagerAccess, eventManagerFieldAccess, hasRole } from '@/src/access/roles'
import { recurringDays, recurringOccurrences } from '@/src/utils/recurring-food'
import { capitalizeName } from '@/lib/utils/formatters'

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
      admin: {
        position: 'sidebar',
        description: 'Public events will be displayed on the site.',
      },
    },
    {
      name: 'organizer',
      label: 'Name of Event',
      type: 'text',
      required: true,
      index: true,
    },
    {
      type: 'row',
      fields: [
        {
          name: 'year',
          type: 'number',
          required: true,
          defaultValue: () => new Date().getFullYear(),
          min: 2000,
          max: 2100,
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
    {
      name: 'location',
      type: 'relationship',
      relationTo: 'locations',
      required: true,
      hasMany: false,
      index: true,
      admin: { position: 'sidebar' },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'startTime',
          type: 'date',
          admin: {
            width: '50%',
            date: { pickerAppearance: 'timeOnly', displayFormat: 'h:mm a' },
          },
        },
        {
          name: 'endTime',
          type: 'date',
          admin: {
            width: '50%',
            date: { pickerAppearance: 'timeOnly', displayFormat: 'h:mm a' },
          },
        },
      ],
    },
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
    {
      name: 'site',
      type: 'text',
      admin: {
        description: 'This will be linked on the website.',
        condition: (data) => data?.visibility !== 'private',
        position: 'sidebar',
      },
    },
    {
      name: 'tags',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Music', value: 'music' },
        { label: 'Food', value: 'utensils' },
        { label: 'Games', value: 'puzzle' },
        { label: 'Sports', value: 'sports' },
        { label: 'Beer Release', value: 'beer-release' },
        { label: 'Karaoke', value: 'mic-vocal' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'description', type: 'textarea' },
    {
      name: 'attendees',
      type: 'number',
      access: { read: eventManagerFieldAccess },
      admin: {
        description: 'Expected or registered attendees',
        position: 'sidebar',
      },
    },
    {
      name: 'pointOfContact',
      type: 'text',
      access: { read: eventManagerFieldAccess },
      admin: { position: 'sidebar' },
    },
    {
      name: 'email',
      type: 'email',
      access: { read: eventManagerFieldAccess },
      admin: { position: 'sidebar' },
    },
    {
      name: 'phone',
      type: 'text',
      access: { read: eventManagerFieldAccess },
      admin: {
        condition: (data) => data?.visibility === 'private',
        position: 'sidebar',
      },
    },
    {
      name: 'otherInfo',
      type: 'textarea',
      access: { read: eventManagerFieldAccess },
      admin: {
        description: 'Additional information for private events',
        condition: (data) => data?.visibility === 'private',
        position: 'sidebar',
      },
    },
  ],
}
