import type { CollectionConfig } from 'payload'
import { eventManagerAccess, hasRole } from '@/src/access/roles'
import {
  eventDetailFields,
  locationField,
  organizerField,
  timeRowField,
  visibilityField,
} from '@/src/collections/shared/event-fields'

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
    visibilityField,
    organizerField,
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
    timeRowField,
    locationField,
    {
      name: 'dateWarning',
      type: 'ui',
      admin: {
        components: {
          Field: './components/EventDateWarning#EventDateWarning',
        },
      },
    },
    ...eventDetailFields,
  ],
}
