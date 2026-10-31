/**
 * Staff inbox for completed public donation requests.
 * Creates only happen through the /donate server action (overrideAccess);
 * the REST API is not a public drop-box. Staff cannot create rows in admin —
 * the public form is the only writer.
 */
import type { CollectionConfig } from 'payload'
import { adminAccess, eventManagerAccess } from '@/src/access/roles'
import { DONATION_MAX_ATTENDEES, DONATION_MAX_TEXT } from '@/lib/donate/donation-request'
import { slackDiagnosticsField } from './utils/slackDiagnosticsField'

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
    defaultColumns: ['organizationName', 'eventDate', 'askType', 'status', 'createdAt'],
    description:
      'Public donation asks from /donate. Completing the form is not a yes. Rows are created only by the public form.',
  },
  fields: [
    { name: 'submissionKey', type: 'text', unique: true, admin: { hidden: true } },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      options: [
        { label: 'New', value: 'new' },
        { label: 'Approved', value: 'approved' },
        { label: 'Declined', value: 'declined' },
      ],
      admin: {
        position: 'sidebar',
        description:
          'Records the staff decision only; does not send a reply. Use Email requester to write one.',
      },
      label: 'Decision status',
    },
    {
      name: 'emailRequester',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: { Field: '@/src/components/admin/DonationReplyButton#DonationReplyButton' },
      },
    },
    { name: 'organizationName', ...text() },
    {
      name: 'askType',
      type: 'select',
      required: true,
      options: [
        { label: 'Product pickup', value: 'product' },
        { label: 'Taproom fundraiser night', value: 'taproom-night' },
      ],
      label: 'Request type',
    },
    { name: 'eventName', ...text() },
    {
      type: 'row',
      fields: [
        {
          name: 'eventDate',
          type: 'date',
          required: true,
          admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'MMM d, yyyy' } },
        },
        {
          name: 'attendees',
          type: 'number',
          required: true,
          min: 1,
          max: DONATION_MAX_ATTENDEES,
          label: 'Estimated attendance',
        },
      ],
    },
    { name: 'venue', ...text({ maxLength: 400 }) },
    {
      name: 'taproom',
      type: 'text',
      maxLength: 80,
      admin: {
        description: 'Location slug from the public form, when the ask is a taproom night.',
        condition: (_: unknown, sibling: { askType?: string }) =>
          sibling?.askType === 'taproom-night',
      },
    },
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
    {
      name: 'pickupName',
      ...text({
        required: false,
        admin: {
          condition: (_: unknown, sibling: { askType?: string }) => sibling?.askType === 'product',
        },
      }),
    },
    { name: 'contactName', ...text() },
    {
      type: 'row',
      fields: [
        { name: 'email', type: 'email', required: true, label: 'Contact email' },
        { name: 'phone', ...text({ maxLength: 32 }) },
      ],
    },
    {
      type: 'collapsible',
      label: 'Organization & background',
      admin: { initCollapsed: true },
      fields: [
        { name: 'mission', ...longText() },
        {
          name: 'previousDonation',
          type: 'select',
          required: true,
          options: [
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' },
          ],
          label: 'Received a donation before?',
        },
        { name: 'recognition', ...longText() },
        { name: 'whyLolev', ...longText() },
        { name: 'howHeard', ...longText() },
      ],
    },
    slackDiagnosticsField,
    {
      name: 'ipHash',
      type: 'text',
      index: true,
      admin: { hidden: true },
    },
  ],
  defaultSort: '-createdAt',
}
