/**
 * Slack channel lookup for system pings, and the best-effort ping after a
 * public form write.
 *
 * `slackChannelFor` reads the channel set in Admin → Content → Slack Channels;
 * the nightly Google hours check (`src/jobs/check-google-hours.ts`) uses it too.
 * `notifyCollectionOnSlack` records success or failure on the inbox row, with
 * unfurls off so submitted text cannot fetch arbitrary URLs in Slack; a blank
 * or invalid channel setting falls back to `args.channel` (env var or `#events`).
 */

import type { Payload } from 'payload'
import { logger } from '@/lib/utils/logger'
import { resolveSlackChannel } from '@/lib/slack/mrkdwn'
import { slackApi } from '@/src/utils/slack-api'

const ADMIN_CHANNEL_FIELD = {
  'donation-requests': 'donations',
  'job-applications': 'jobs',
  'event-inquiries': 'eventInquiries',
} as const

/**
 * The channel set in Admin → Content → Slack Channels for `field`; when that
 * is blank, invalid or unreadable, `fallback`, which defaults to `#events`.
 */
export async function slackChannelFor(
  payload: Payload,
  field: (typeof ADMIN_CHANNEL_FIELD)[keyof typeof ADMIN_CHANNEL_FIELD] | 'hours',
  fallback?: string,
): Promise<string> {
  try {
    const settings = await payload.findGlobal({
      slug: 'site-content',
      depth: 0,
      select: { slackChannels: true },
      overrideAccess: true,
    })
    return resolveSlackChannel(settings.slackChannels?.[field] ?? undefined, fallback)
  } catch (error) {
    logger.error('Slack channel settings read failed', error)
    return resolveSlackChannel(undefined, fallback)
  }
}

export async function notifyCollectionOnSlack(
  payload: Payload,
  args: {
    collection: keyof typeof ADMIN_CHANNEL_FIELD
    id: string | number
    channel: string
    message: { text: string; blocks: Array<Record<string, unknown>> }
    failLog: string
  },
): Promise<void> {
  try {
    const channel = await slackChannelFor(
      payload,
      ADMIN_CHANNEL_FIELD[args.collection],
      args.channel,
    )
    const posted = await slackApi('chat.postMessage', {
      channel,
      unfurl_links: false,
      unfurl_media: false,
      ...args.message,
    })
    await payload.update({
      collection: args.collection,
      id: args.id,
      overrideAccess: true,
      data: posted
        ? { slackNotifiedAt: new Date().toISOString(), slackError: null }
        : { slackError: `Slack ping to ${channel} failed` },
    })
    if (!posted) logger.error(`${args.failLog} (${channel})`)
  } catch (error) {
    logger.error(`${args.failLog} after()`, error)
  }
}
