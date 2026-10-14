/**
 * Staff inbox for job applications. Creates only through the public apply action.
 */
import type { CollectionConfig } from 'payload'
import { adminAccess } from '@/src/access/roles'
import { JOB_APPLICATION_MAX_TEXT } from '@/lib/jobs/application'

export const JobApplications: CollectionConfig = {
  slug: 'job-applications',
  access: {
    read: adminAccess,
    create: () => false,
    update: adminAccess,
    delete: adminAccess,
  },
  admin: {
    group: 'Hiring',
    useAsTitle: 'name',
    defaultColumns: ['name', 'job', 'createdAt', 'email'],
    description: 'Applications from /jobs/[slug]. Completing the form is not a hire.',
  },
  fields: [
    { name: 'submissionKey', type: 'text', unique: true, admin: { hidden: true } },
    { name: 'name', type: 'text', required: true, maxLength: 200, label: 'Applicant name' },
    {
      name: 'job',
      type: 'relationship',
      relationTo: 'jobs',
      required: true,
      index: true,
      label: 'Applied-for opening',
    },
    {
      type: 'row',
      fields: [
        { name: 'email', type: 'email', required: true },
        { name: 'phone', type: 'text', required: true, maxLength: 32 },
      ],
    },
    {
      name: 'message',
      type: 'textarea',
      required: true,
      maxLength: JOB_APPLICATION_MAX_TEXT,
      label: 'Application message',
    },
    {
      type: 'collapsible',
      label: 'Notification diagnostics',
      admin: { initCollapsed: true, position: 'sidebar' },
      fields: [
        {
          name: 'slackNotifiedAt',
          type: 'date',
          admin: { position: undefined, readOnly: true },
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
      admin: { hidden: true },
    },
  ],
  defaultSort: '-createdAt',
}
