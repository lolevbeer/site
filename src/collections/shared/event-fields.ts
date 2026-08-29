import type { Field } from 'payload'
import { eventManagerFieldAccess } from '@/src/access/roles'

/**
 * Field definitions shared verbatim between the Events and RecurringEvents
 * collections. Collection-specific fields (Events' `date`; RecurringEvents'
 * `year`/`day`/`occurrences`/`excludedDates`/`active`) stay in their own
 * collection configs; each config spreads these in its own admin order.
 */

export const visibilityField: Field = {
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
    description: 'Public events will be displayed on the site',
  },
}

export const organizerField: Field = {
  name: 'organizer',
  label: 'Name of Event',
  type: 'text',
  required: true,
  index: true,
  admin: {
    description: 'If this is a public event, this will be listed on the website',
  },
}

export const timeRowField: Field = {
  type: 'row',
  fields: [
    {
      name: 'startTime',
      type: 'date',
      admin: {
        width: '50%',
        date: {
          pickerAppearance: 'timeOnly',
          displayFormat: 'h:mm a',
        },
      },
    },
    {
      name: 'endTime',
      type: 'date',
      admin: {
        width: '50%',
        date: {
          pickerAppearance: 'timeOnly',
          displayFormat: 'h:mm a',
        },
      },
    },
  ],
}

export const locationField: Field = {
  name: 'location',
  type: 'relationship',
  relationTo: 'locations',
  required: true,
  hasMany: false,
  index: true,
  admin: {
    position: 'sidebar',
  },
}

/**
 * Trailing detail fields that appear in the same order at the end of both
 * collections: site, tags, description, attendees, pointOfContact, email,
 * phone, otherInfo.
 */
export const eventDetailFields: Field[] = [
  {
    name: 'site',
    type: 'text',
    admin: {
      description: 'This will be linked on the website',
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
    admin: {
      position: 'sidebar',
    },
  },
  {
    name: 'description',
    type: 'textarea',
  },
  {
    name: 'attendees',
    type: 'number',
    access: {
      read: eventManagerFieldAccess,
    },
    admin: {
      description: 'Expected or registered attendees',
      position: 'sidebar',
    },
  },
  {
    name: 'pointOfContact',
    type: 'text',
    access: {
      read: eventManagerFieldAccess,
    },
    admin: {
      position: 'sidebar',
    },
  },
  {
    name: 'email',
    type: 'email',
    access: {
      read: eventManagerFieldAccess,
    },
    admin: {
      position: 'sidebar',
    },
  },
  {
    name: 'phone',
    type: 'text',
    access: {
      read: eventManagerFieldAccess,
    },
    admin: {
      condition: (data) => data?.visibility === 'private',
      position: 'sidebar',
    },
  },
  {
    name: 'otherInfo',
    type: 'textarea',
    access: {
      read: eventManagerFieldAccess,
    },
    admin: {
      description: 'Additional information for private event',
      condition: (data) => data?.visibility === 'private',
      position: 'sidebar',
    },
  },
]
