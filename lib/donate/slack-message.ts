/**
 * Block Kit summary posted to Slack #events when a donation request lands.
 * Contact PII stays in Admin — the ping is org, event, and ask only.
 */

import {
  clip,
  escapeMrkdwn,
  field,
  resolveSlackChannel,
  slackPlainText,
} from '@/lib/slack/mrkdwn'
import { DONATION_SLACK_CHANNEL, type ValidatedDonationRequest } from './donation-request'

/** Channel for donation pings (`SLACK_DONATION_CHANNEL` or `#events`). */
export function donationSlackChannel(): string {
  return resolveSlackChannel(process.env.SLACK_DONATION_CHANNEL, DONATION_SLACK_CHANNEL)
}

export type DonationSlackFields = Pick<
  ValidatedDonationRequest,
  | 'organizationName'
  | 'eventName'
  | 'eventDate'
  | 'askType'
  | 'taproom'
  | 'venue'
  | 'attendees'
  | 'requestDetails'
  | 'whyLolev'
  | 'previousDonation'
>

/**
 * chat.postMessage body (minus channel) for a completed donation request.
 */
export function buildDonationSlackMessage(input: DonationSlackFields): {
  text: string
  blocks: Array<Record<string, unknown>>
} {
  const org = input.organizationName.trim()
  const eventName = input.eventName.trim()
  const ask =
    input.askType === 'taproom-night'
      ? `Taproom night (${input.taproom.trim() || 'unspecified'})`
      : 'Product pickup'
  const text = escapeMrkdwn(
    clip(`Donation request: ${org} — ${eventName} (${ask})`, 280),
  )

  return {
    text,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: slackPlainText(`Donation request: ${org}`, 140) },
      },
      {
        type: 'section',
        fields: [
          field('Event', `${eventName} — ${input.eventDate.trim()}`),
          field('Ask', ask),
          field('Venue', input.venue.trim()),
          field('21+ attendance', String(input.attendees)),
          field('Donated before', input.previousDonation === 'yes' ? 'Yes' : 'No'),
        ],
      },
      {
        type: 'section',
        text: field('What they want', input.requestDetails.trim()),
      },
      {
        type: 'section',
        text: field('Why Lolev', input.whyLolev.trim()),
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Inbox is Admin → Donation Requests. Completing the form is not a yes. Contact details are in the inbox, not here.',
          },
        ],
      },
    ],
  }
}
