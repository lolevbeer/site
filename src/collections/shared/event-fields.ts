/** Shared event fields keep public listing content separate from access-controlled staff notes. */
import type { Field } from 'payload'
import { authenticatedFieldAccess, eventManagerFieldAccess } from '@/src/access/roles'

export const visibilityField: Field = {
  name: 'visibility',
  label: 'Event visibility',
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
    description: 'Public events appear on the website. Private events remain in staff scheduling.',
  },
}

export const organizerField: Field = {
  name: 'organizer',
  label: 'Event name',
  type: 'text',
  required: true,
  index: true,
  admin: { description: 'Shown on the website when the event is public.' },
}

export const timeRowField: Field = {
  type: 'row',
  fields: [
    {
      name: 'startTime',
      label: 'Start time',
      type: 'date',
      admin: { width: '50%', date: { pickerAppearance: 'timeOnly', displayFormat: 'h:mm a' } },
    },
    {
      name: 'endTime',
      label: 'End time',
      type: 'date',
      admin: { width: '50%', date: { pickerAppearance: 'timeOnly', displayFormat: 'h:mm a' } },
    },
  ],
}

export const locationField: Field = {
  name: 'location',
  label: 'Taproom',
  type: 'relationship',
  relationTo: 'locations',
  required: true,
  hasMany: false,
  index: true,
}

/** Unnamed disclosures preserve root-level stored paths in both event collections. */
export const eventDetailFields: Field[] = [
  {
    name: 'description',
    label: 'Staff notes',
    type: 'textarea',
    // Public reads never receive these notes; public listings use the event name.
    access: { read: authenticatedFieldAccess },
    admin: {
      rows: 3,
      description: 'Internal notes for signed-in staff only. Never shown on the website.',
    },
  },
  {
    type: 'collapsible',
    label: 'Website listing',
    admin: { initCollapsed: true },
    fields: [
      {
        name: 'site',
        label: 'Website or ticket URL',
        type: 'text',
        admin: {
          description: 'Public link shown with the event.',
          condition: (data) => data?.visibility !== 'private',
        },
      },
      {
        name: 'tags',
        label: 'Event tags',
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
      },
      {
        name: 'image',
        label: 'Event image',
        type: 'upload',
        relationTo: 'media',
        admin: {
          description: 'Optional image for search results; falls back to the site social image.',
          condition: (data) => data?.visibility !== 'private',
        },
      },
    ],
  },
  {
    type: 'collapsible',
    label: 'Booking & contact',
    admin: { initCollapsed: true },
    fields: [
      {
        name: 'attendees',
        label: 'Expected attendees',
        type: 'number',
        access: { read: eventManagerFieldAccess },
        admin: {
          description: 'Expected or registered attendance. Admins and event managers only.',
        },
      },
      {
        name: 'pointOfContact',
        label: 'Contact name',
        type: 'text',
        access: { read: eventManagerFieldAccess },
      },
      {
        type: 'row',
        fields: [
          {
            name: 'email',
            label: 'Contact email',
            type: 'email',
            access: { read: eventManagerFieldAccess },
            admin: { width: '50%' },
          },
          {
            name: 'phone',
            label: 'Contact phone',
            type: 'text',
            access: { read: eventManagerFieldAccess },
            admin: { width: '50%', condition: (data) => data?.visibility === 'private' },
          },
        ],
      },
      {
        name: 'otherInfo',
        label: 'Booking notes',
        type: 'textarea',
        access: { read: eventManagerFieldAccess },
        admin: {
          rows: 3,
          description: 'Admins and event managers only. Never shown on the website.',
        },
      },
    ],
  },
]
