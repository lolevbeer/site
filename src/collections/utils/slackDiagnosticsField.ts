/**
 * Read-only Slack delivery status for the public-form inboxes (donation requests,
 * private-event inquiries, job applications). `lib/slack/notify.ts` writes both
 * fields after the form saves; staff only read them, so they sit collapsed.
 */
import type { CollapsibleField } from 'payload'

export const slackDiagnosticsField: CollapsibleField = {
  type: 'collapsible',
  label: 'Notification diagnostics',
  admin: { initCollapsed: true, position: 'sidebar' },
  fields: [
    {
      name: 'slackNotifiedAt',
      label: 'Slack notification sent',
      type: 'date',
      admin: {
        readOnly: true,
        description:
          'Set when the Slack ping succeeds. Empty means no successful ping is recorded.',
      },
    },
    { name: 'slackError', type: 'text', maxLength: 200, admin: { readOnly: true } },
  ],
}
