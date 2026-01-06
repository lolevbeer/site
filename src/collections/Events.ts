import type { CollectionConfig } from 'payload'
import { eventManagerAccess, hasRole, isAdmin } from '@/src/access/roles'

export const Events: CollectionConfig = {
  slug: 'events',
  access: {
    read: ({ req: { user } }) => {
      // Admins and event managers can read all events
      if (hasRole(user, ['admin', 'event-manager'])) {
        return true
      }
      // Public can only read public events
      return {
        visibility: {
          equals: 'public',
        },
      }
    },
    create: eventManagerAccess,
    update: eventManagerAccess,
    delete: eventManagerAccess,
  },
  admin: {
    group: 'Food & Events',
    useAsTitle: 'organizer',
    hideAPIURL: true,
    defaultColumns: ['organizer', 'date', 'location', 'visibility'],
    pagination: {
      defaultLimit: 100,
    },
  },
  fields: [
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
        description: 'Public events will be displayed on the site',
      },
    },
    {
      name: 'organizer',
      label: 'Name of Event',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'If this is a public event, this will be listed on the website',
      },
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      index: true,
      admin: {
        date: {
          displayFormat: 'MMM d, yyyy',
        },
      },
    },
    {
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
    },
    {
      name: 'location',
      type: 'relationship',
      relationTo: 'locations',
      required: true,
      hasMany: false,
      index: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'dateWarning',
      type: 'ui',
      admin: {
        components: {
          Field: './components/EventDateWarning#EventDateWarning',
        },
      },
    },
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
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'attendees',
      type: 'number',
      admin: {
        description: 'Expected or registered attendees',
        position: 'sidebar',
      },
    },
    {
      name: 'pointOfContact',
      type: 'text',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'email',
      type: 'email',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'phone',
      type: 'text',
      admin: {
        condition: (data) => data?.visibility === 'private',
        position: 'sidebar',
      },
    },
    {
      name: 'otherInfo',
      type: 'textarea',
      admin: {
        description: 'Additional information for private event',
        condition: (data) => data?.visibility === 'private',
        position: 'sidebar',
      },
    },
  ],
}
