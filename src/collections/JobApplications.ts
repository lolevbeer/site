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
    group: 'Settings',
    useAsTitle: 'name',
    hideAPIURL: true,
    defaultColumns: ['name', 'job', 'email', 'createdAt'],
    description: 'Applications from /jobs/[slug]. Completing the form is not a hire.',
  },
  fields: [
    {
      name: 'job',
      type: 'relationship',
      relationTo: 'jobs',
      required: true,
      index: true,
    },
    { name: 'name', type: 'text', required: true, maxLength: 200 },
    { name: 'email', type: 'email', required: true },
    { name: 'phone', type: 'text', required: true, maxLength: 32 },
    { name: 'message', type: 'textarea', required: true, maxLength: JOB_APPLICATION_MAX_TEXT },
    {
      name: 'slackNotifiedAt',
      type: 'date',
      admin: { position: 'sidebar', readOnly: true },
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
