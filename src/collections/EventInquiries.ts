/**
 * Staff inbox for private-event inquiries from the form on /events.
 * Creates only happen through the server action (overrideAccess); the REST
 * API is not a public drop-box and staff cannot create rows in admin.
 * Inquiries never become Events automatically.
 */
import type { CollectionConfig } from 'payload'
import { adminAccess, adminFieldAccess, eventManagerAccess } from '@/src/access/roles'
import { EVENT_INQUIRY_MAX_HEADCOUNT, EVENT_INQUIRY_MAX_TEXT } from '@/lib/events/inquiry'

export const EventInquiries: CollectionConfig = {
  slug: 'event-inquiries',
  access: {
    read: eventManagerAccess,
    create: () => false,
    update: eventManagerAccess,
    delete: adminAccess,
  },
  admin: {
    group: 'Food & Events',
    useAsTitle: 'name',
    defaultColumns: ['name', 'status', 'preferredDate', 'taproom', 'headcount', 'createdAt'],
    description:
      'Requests from /events, not confirmed bookings. Marking Booked does not create an Event; enter that booking separately.',
  },
  fields: [
    { name: 'submissionKey', type: 'text', unique: true, admin: { hidden: true } },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      options: [
        { label: 'New', value: 'new' },
        { label: 'Contacted', value: 'contacted' },
        { label: 'Booked', value: 'booked' },
        { label: 'Declined', value: 'declined' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'preferredDate',
      type: 'date',
      required: true,
      admin: {
        date: { pickerAppearance: 'dayOnly', displayFormat: 'MMM d, yyyy' },
        description: 'Requested date, not a confirmed booking.',
      },
      label: 'Preferred date',
    },
    {
      name: 'taproom',
      type: 'relationship',
      relationTo: 'locations',
      required: true,
      label: 'Taproom',
    },
    {
      name: 'headcount',
      type: 'number',
      required: true,
      min: 1,
      max: EVENT_INQUIRY_MAX_HEADCOUNT,
      label: 'Estimated guests',
    },
    {
      name: 'message',
      type: 'textarea',
      maxLength: EVENT_INQUIRY_MAX_TEXT,
      label: 'Event requirements / message',
    },
    { name: 'name', type: 'text', required: true, maxLength: 200, label: 'Requester name' },
    {
      type: 'row',
      fields: [
        { name: 'email', type: 'email', required: true },
        { name: 'phone', type: 'text', required: true, maxLength: 32 },
      ],
    },
    {
      type: 'collapsible',
      label: 'Notification diagnostics',
      admin: { initCollapsed: true, position: 'sidebar' },
      fields: [
        {
          name: 'slackNotifiedAt',
          type: 'date',
          admin: {
            position: undefined,
            readOnly: true,
            description:
              'Automatic notification to the configured channel; empty means none is recorded.',
          },
          label: 'Slack notification sent',
        },
        {
          name: 'slackError',
          type: 'text',
          maxLength: 200,
          admin: { position: undefined, readOnly: true },
        },
      ],
    },
    {
      name: 'ipHash',
      type: 'text',
      index: true,
      // Admin-only so event managers never receive it over REST/GraphQL. The
      // public action's rate-limit query runs with overrideAccess.
      access: { read: adminFieldAccess },
      admin: { hidden: true },
    },
  ],
  labels: { singular: 'Private Event Inquiry', plural: 'Private Event Inquiries' },
  defaultSort: '-createdAt',
}
