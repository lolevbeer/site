/**
 * Slack #events ping for a private-event inquiry from /private-events.
 * Contact PII stays in Admin — the ping is taproom, date, and headcount only.
 */

import {
  clip,
  DEFAULT_SLACK_CHANNEL,
  escapeMrkdwn,
  field,
  resolveSlackChannel,
  slackPlainText,
} from '@/lib/slack/mrkdwn'

/**
 * Channel for inquiry pings (`SLACK_EVENT_INQUIRY_CHANNEL`, else the donation
 * channel, else `#events`). Admin → Site Content → Slack Channels overrides it
 * in `notifyCollectionOnSlack`.
 */
export function eventInquirySlackChannel(): string {
  return resolveSlackChannel(
    process.env.SLACK_EVENT_INQUIRY_CHANNEL || process.env.SLACK_DONATION_CHANNEL,
    DEFAULT_SLACK_CHANNEL,
  )
}

export function buildEventInquirySlackMessage(input: {
  preferredDate: string
  headcount: number
  taproomName: string
}): { text: string; blocks: Array<Record<string, unknown>> } {
  const summary = `${input.taproomName} — ${input.preferredDate}, ${input.headcount} guests`
  return {
    text: escapeMrkdwn(clip(`Private event inquiry: ${summary}`, 280)),
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: slackPlainText(`Private event inquiry: ${input.taproomName}`, 140),
        },
      },
      {
        type: 'section',
        fields: [
          field('Taproom', input.taproomName),
          field('Preferred date', input.preferredDate),
          field('Guests', String(input.headcount)),
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Inbox is Admin → Event Inquiries. Contact details are in the inbox, not here.',
          },
        ],
      },
    ],
  }
}
