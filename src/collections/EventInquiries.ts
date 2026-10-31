/**
 * Staff inbox for private-event inquiries from the form on /private-events.
 * Creates only happen through the server action (overrideAccess); the REST
 * API is not a public drop-box and staff cannot create rows in admin.
 * Inquiries never become Events automatically.
 *
 * Quote fields (start time, length, drinks, company, food) are
 * required on the form but optional here: inquiries saved before they existed
 * show them blank and must stay editable. Filter company-paid inquiries with
 * the list view's Filters → "Company paying" is "Yes".
 */
import type { CollectionConfig } from 'payload'
import { adminAccess, adminFieldAccess, eventManagerAccess } from '@/src/access/roles'
import {
  EVENT_INQUIRY_DRINKS,
  EVENT_INQUIRY_DURATIONS,
  EVENT_INQUIRY_FOOD_PLANS,
  EVENT_INQUIRY_MAX_HEADCOUNT,
  EVENT_INQUIRY_MAX_TEXT,
  EVENT_INQUIRY_OCCASIONS,
  EVENT_INQUIRY_YES_NO,
} from '@/lib/events/inquiry'
import { slackDiagnosticsField } from './utils/slackDiagnosticsField'

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
    defaultColumns: [
      'name',
      'status',
      'preferredDate',
      'startTime',
      'taproom',
      'headcount',
      'occasion',
      'companyPaid',
      'createdAt',
    ],
    description:
      'Requests from /private-events, not confirmed bookings. Marking Booked does not create an Event; enter that booking separately.',
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
    { name: 'flexibleDate', type: 'checkbox', defaultValue: false, label: 'Date is flexible' },
    {
      // YYYY-MM-DD strings, not date fields: no timezone shift for whole days.
      name: 'otherDates',
      type: 'text',
      hasMany: true,
      label: 'Other dates that work',
      admin: {
        condition: (data) => Boolean(data?.flexibleDate),
        description: 'YYYY-MM-DD days the guest also offered.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          // HH:MM text from the form's time input, not a date field: no timezone shift.
          name: 'startTime',
          type: 'text',
          maxLength: 5,
          label: 'Start time',
          admin: { description: '24-hour, Eastern (18:30 is 6:30pm).' },
        },
        {
          name: 'duration',
          type: 'select',
          options: [...EVENT_INQUIRY_DURATIONS],
          label: 'Length',
        },
      ],
    },
    {
      name: 'drinks',
      type: 'select',
      options: [...EVENT_INQUIRY_DRINKS],
      label: 'Drinks',
    },
    {
      type: 'row',
      fields: [
        {
          name: 'companyPaid',
          type: 'select',
          options: [...EVENT_INQUIRY_YES_NO],
          label: 'Company paying',
        },
        {
          name: 'companyName',
          type: 'text',
          maxLength: 200,
          label: 'Company name',
          admin: { condition: (data) => data?.companyPaid === 'yes' },
        },
      ],
    },
    {
      name: 'foodPlan',
      type: 'select',
      options: [...EVENT_INQUIRY_FOOD_PLANS],
      label: 'Food plan',
    },
    {
      name: 'occasion',
      type: 'select',
      options: EVENT_INQUIRY_OCCASIONS.map(({ value, adminLabel }) => ({
        value,
        label: adminLabel,
      })),
      label: 'Occasion',
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
        {
          name: 'phone',
          type: 'text',
          maxLength: 32,
          admin: { description: 'Optional on the form.' },
        },
      ],
    },
    slackDiagnosticsField,
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
