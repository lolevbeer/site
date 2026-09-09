/**
 * Slack #events ping for a job application.
 * Applicant PII stays in Admin — the ping is role and location only.
 */

import {
  clip,
  DEFAULT_SLACK_CHANNEL,
  escapeMrkdwn,
  field,
  resolveSlackChannel,
  slackPlainText,
} from '@/lib/slack/mrkdwn'

/** Channel for job pings (`SLACK_JOBS_CHANNEL`, else donation channel, else `#events`). */
export function jobApplicationSlackChannel(): string {
  return resolveSlackChannel(
    process.env.SLACK_JOBS_CHANNEL || process.env.SLACK_DONATION_CHANNEL,
    DEFAULT_SLACK_CHANNEL,
  )
}

export function buildJobApplicationSlackMessage(input: {
  jobTitle: string
  locationName: string
}): { text: string; blocks: Array<Record<string, unknown>> } {
  const text = escapeMrkdwn(clip(`Job application for ${input.jobTitle}`, 280))
  return {
    text,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: slackPlainText(`Application: ${input.jobTitle}`, 140) },
      },
      {
        type: 'section',
        fields: [field('Location', input.locationName)],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Inbox is Admin → Job Applications. Applicant contact is in the inbox, not here.',
          },
        ],
      },
    ],
  }
}
