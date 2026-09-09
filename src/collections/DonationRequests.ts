/**
 * Staff inbox for completed public donation requests.
 * Creates only happen through the /donate server action (overrideAccess);
 * the REST API is not a public drop-box. Staff cannot create rows in admin —
 * the public form is the only writer.
 */
import type { CollectionConfig } from 'payload'
import { adminAccess, eventManagerAccess } from '@/src/access/roles'
import { DONATION_MAX_ATTENDEES, DONATION_MAX_TEXT } from '@/lib/donate/donation-request'

const text = (overrides: Record<string, unknown> = {}) => ({
  type: 'text' as const,
  required: true,
  maxLength: 200,
  ...overrides,
})

const longText = (overrides: Record<string, unknown> = {}) => ({
  type: 'textarea' as const,
  required: true,
  maxLength: DONATION_MAX_TEXT,
  ...overrides,
})

export const DonationRequests: CollectionConfig = {
  slug: 'donation-requests',
  access: {
    read: eventManagerAccess,
    create: () => false,
    update: eventManagerAccess,
    delete: adminAccess,
  },
  admin: {
    group: 'Food & Events',
    useAsTitle: 'organizationName',
    hideAPIURL: true,
    defaultColumns: ['organizationName', 'eventDate', 'askType', 'status', 'createdAt'],
    description:
      'Public donation asks from /donate. Completing the form is not a yes. Rows are created only by the public form.',
  },
  fields: [
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      options: [
        { label: 'New', value: 'new' },
        { label: 'Approved', value: 'approved' },
        { label: 'Declined', value: 'declined' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'askType',
      type: 'select',
      required: true,
      options: [
        { label: 'Product pickup', value: 'product' },
        { label: 'Taproom fundraiser night', value: 'taproom-night' },
      ],
    },
    { name: 'organizationName', ...text() },
    { name: 'contactName', ...text() },
    { name: 'email', type: 'email', required: true },
    { name: 'phone', ...text({ maxLength: 32 }) },
    { name: 'mission', ...longText() },
    { name: 'howHeard', ...longText() },
    {
      name: 'previousDonation',
      type: 'select',
      required: true,
      options: [
        { label: 'Yes', value: 'yes' },
        { label: 'No', value: 'no' },
      ],
    },
    { name: 'eventName', ...text() },
    {
      name: 'eventDate',
      type: 'date',
      required: true,
      admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'MMM d, yyyy' } },
    },
    { name: 'venue', ...text({ maxLength: 400 }) },
    { name: 'attendees', type: 'number', required: true, min: 1, max: DONATION_MAX_ATTENDEES },
    { name: 'requestDetails', ...longText() },
    {
      name: 'howServed',
      ...longText({
        required: false,
        admin: {
          condition: (_: unknown, sibling: { askType?: string }) => sibling?.askType === 'product',
        },
      }),
    },
    { name: 'recognition', ...longText() },
    { name: 'whyLolev', ...longText() },
    {
      name: 'pickupName',
      ...text({
        required: false,
        admin: {
          condition: (_: unknown, sibling: { askType?: string }) => sibling?.askType === 'product',
        },
      }),
    },
    {
      name: 'taproom',
      type: 'text',
      maxLength: 80,
      admin: {
        description: 'Location slug from the public form, when the ask is a taproom night.',
        condition: (_: unknown, sibling: { askType?: string }) => sibling?.askType === 'taproom-night',
      },
    },
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
      admin: { hidden: true },
    },
  ],
}
