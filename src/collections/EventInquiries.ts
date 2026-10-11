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
    defaultColumns: ['name', 'preferredDate', 'headcount', 'taproom', 'status', 'createdAt'],
    description: 'Private-event inquiries from /events. Rows are created only by the public form.',
  },
  fields: [
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
    { name: 'name', type: 'text', required: true, maxLength: 200 },
    { name: 'email', type: 'email', required: true },
    { name: 'phone', type: 'text', required: true, maxLength: 32 },
    {
      name: 'preferredDate',
      type: 'date',
      required: true,
      admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'MMM d, yyyy' } },
    },
    {
      name: 'headcount',
      type: 'number',
      required: true,
      min: 1,
      max: EVENT_INQUIRY_MAX_HEADCOUNT,
    },
    { name: 'taproom', type: 'relationship', relationTo: 'locations', required: true },
    { name: 'message', type: 'textarea', maxLength: EVENT_INQUIRY_MAX_TEXT },
    {
      name: 'slackNotifiedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'When the #events ping succeeded. Empty means staff should check Slack.',
      },
    },
    {
      name: 'slackError',
      type: 'text',
      maxLength: 200,
      admin: { position: 'sidebar', readOnly: true },
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
}
