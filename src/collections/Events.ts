import type { CollectionConfig } from 'payload'
import { eventManagerAccess } from '@/src/access/roles'
import { readEvents } from '@/src/access/schedules'
import {
  eventDetailFields,
  locationField,
  organizerField,
  timeRowField,
  visibilityField,
} from '@/src/collections/shared/event-fields'

export const Events: CollectionConfig = {
  slug: 'events',
  // Admin deletes go to the trash and can be restored (#368).
  trash: true,
  access: {
    read: readEvents,
    create: eventManagerAccess,
    update: eventManagerAccess,
    delete: eventManagerAccess,
  },
  admin: {
    group: 'Food & Events',
    useAsTitle: 'organizer',
    // The list's search box; without this it matches the title field only.
    listSearchableFields: ['organizer', 'summary'],
    defaultColumns: ['organizer', 'date', 'startTime', 'location', 'visibility'],
    pagination: {
      defaultLimit: 100,
    },
  },
  fields: [
    visibilityField,
    organizerField,
    locationField,
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
    {
      name: 'dateWarning',
      type: 'ui',
      admin: {
        components: {
          Field: '@/src/components/EventDateWarning#EventDateWarning',
        },
      },
    },
    ...eventDetailFields,
  ],
  labels: { singular: 'Dated Event', plural: 'Dated Events' },
}
