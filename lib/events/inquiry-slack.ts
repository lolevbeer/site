/**
 * Slack #events ping for a private-event inquiry from /private-events.
 *
 * Every answer on the form, laid out to scan: a header with the guest's name,
 * one line of contact details, a two-column grid of the short answers, the
 * note in full at the bottom, and a link to the inbox row. Blank answers are
 * left out rather than shown as empty labels.
 */

import {
  clip,
  DEFAULT_SLACK_CHANNEL,
  escapeMrkdwn,
  field,
  resolveSlackChannel,
  slackPlainText,
} from '@/lib/slack/mrkdwn'
import {
  EVENT_INQUIRY_DRINKS,
  EVENT_INQUIRY_DURATIONS,
  EVENT_INQUIRY_FOOD_PLANS,
  occasionAdminLabel,
  optionLabel,
} from '@/lib/events/inquiry'
import { eventInquiryAdminUrl, type EventInquiryNotice } from '@/lib/events/inquiry-email'
import { formatTime } from '@/lib/utils/formatters'

/**
 * Channel for inquiry pings (`SLACK_EVENT_INQUIRY_CHANNEL`, else the donation
 * channel, else `#events`). Admin → Content → Slack Channels overrides it
 * in `notifyCollectionOnSlack`.
 */
export function eventInquirySlackChannel(): string {
  return resolveSlackChannel(
    process.env.SLACK_EVENT_INQUIRY_CHANNEL || process.env.SLACK_DONATION_CHANNEL,
    DEFAULT_SLACK_CHANNEL,
  )
}

/** Section text is capped at 3000 characters; leave room for the label. */
const NOTES_MAX = 2900

/** "Fri, Nov 20, 2026" for a YYYY-MM-DD day; the raw string if it does not parse. */
function formatSlackDay(ymd: string): string {
  const [year, month, day] = ymd.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (!year || !month || !day || Number.isNaN(date.getTime())) return ymd
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** chat.postMessage body (minus channel) for a new private-event inquiry. */
export function buildEventInquirySlackMessage(input: EventInquiryNotice): {
  text: string
  blocks: Array<Record<string, unknown>>
} {
  const { name, message } = input
  const day = formatSlackDay(input.preferredDate)
  const date = input.flexibleDate ? `${day} (flexible)` : day
  const occasion = input.occasion ? occasionAdminLabel(input.occasion) : undefined
  const start = input.startTime ? formatTime(input.startTime) : ''
  const length = optionLabel(EVENT_INQUIRY_DURATIONS, input.duration)
  const time = [start, length].filter(Boolean).join(' for ')

  // Short answers fill a two-column grid, paired so related answers sit side
  // by side; a blank answer drops out and the rest close up.
  const answers: Array<[string, string | undefined]> = [
    ['Date', date],
    ['Time', time],
    ['Taproom', input.taproomName],
    ['Guests', String(input.headcount)],
    ['Event type', occasion],
    ['Drinks', optionLabel(EVENT_INQUIRY_DRINKS, input.drinks)],
    ['Food', optionLabel(EVENT_INQUIRY_FOOD_PLANS, input.foodPlan)],
    ['Company paying', input.companyName],
    ['Also works', input.otherDates.map(formatSlackDay).join(' · ')],
  ]
  // Section fields cap at 10; the list above is 9.
  const fields = answers
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([label, value]) => field(label, value))

  // The validator has already trimmed every answer.
  const contact = [input.email, input.phone].filter(Boolean).map(escapeMrkdwn).join('   ·   ')
  const adminUrl = eventInquiryAdminUrl(input.id)

  const summary = [name, occasion, input.taproomName, date, `${input.headcount} guests`]
    .filter(Boolean)
    .join(' · ')

  return {
    text: escapeMrkdwn(clip(`Private event inquiry: ${summary}`, 280)),
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: slackPlainText(`Private event inquiry: ${name}`, 140),
        },
      },
      ...(contact ? [{ type: 'section', text: { type: 'mrkdwn', text: contact } }] : []),
      { type: 'section', fields },
      ...(message
        ? [
            {
              type: 'section',
              // Clip after escaping: `&` becomes `&amp;`, so clipping first
              // could still push the block past Slack's limit.
              text: { type: 'mrkdwn', text: `*Notes*\n${clip(escapeMrkdwn(message), NOTES_MAX)}` },
            },
          ]
        : []),
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `<${adminUrl}|Open in Admin → Event Inquiries>` }],
      },
    ],
  }
}
