/**
 * Emails a public job application from /jobs/[slug] to jobs@lolev.beer, with
 * Reply-To set to the applicant so staff can answer straight from the inbox.
 */

import type { Payload } from 'payload'
import { sendPlainTextEmails } from '@/lib/email/send'
import { getBaseUrl } from '@/lib/utils/get-base-url'

export const JOBS_EMAIL = 'jobs@lolev.beer'

export async function sendJobApplicationEmail(
  payload: Payload,
  application: {
    id: string | number
    jobTitle: string
    locationName: string
    name: string
    email: string
    phone: string
    message: string
  },
): Promise<void> {
  const text = [
    `Job: ${application.jobTitle} (${application.locationName})`,
    `Name: ${application.name}`,
    `Email: ${application.email}`,
    `Phone: ${application.phone}`,
    '',
    application.message,
    '',
    `Inbox: ${getBaseUrl()}/admin/collections/job-applications/${application.id}`,
    'Reply to this email to answer the applicant.',
  ].join('\n')

  await sendPlainTextEmails(
    payload,
    [
      {
        to: JOBS_EMAIL,
        replyTo: application.email,
        subject: `Job application: ${application.jobTitle} (${application.locationName}): ${application.name}`,
        text,
      },
    ],
    'Job application email failed',
  )
}
