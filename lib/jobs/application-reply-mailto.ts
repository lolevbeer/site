/**
 * mailto: link for the admin "Email applicant" reply on a job application,
 * built on lib/email/reply-mailto: the applicant's address and a summary of
 * the application. Client-safe (no server imports).
 */

import type { JobApplication } from '@/src/payload-types'
import { clipDetails, replyMailto } from '@/lib/email/reply-mailto'

/** Null when the application has no address that is safe to put in a mailto: link. */
export function jobReplyMailto(application: Partial<JobApplication>): string | null {
  // An unpopulated relationship is a bare ID; leave the title out rather than show it.
  const jobTitle = typeof application.job === 'object' ? application.job?.title : undefined

  const body = [
    `Hi ${application.name ?? ''},`,
    '',
    '',
    '',
    'Your application:',
    jobTitle ? `Job: ${jobTitle}` : null,
    application.message ? clipDetails(application.message) : null,
  ]
    .filter((line) => line !== null)
    .join('\n')

  return replyMailto({
    to: application.email,
    subject: `Your Lolev job application: ${jobTitle ?? ''}`,
    body,
  })
}
