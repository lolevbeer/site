/**
 * Best-effort Slack ping after a public form write. Records success or
 * failure on the inbox row. Unfurls are off so submitted text cannot fetch
 * arbitrary URLs in Slack.
 *
 * The channel set in Admin → Site Content → Slack Channels wins; blank or
 * invalid falls back to `args.channel` (env var or `#events`).
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

/** The Admin-set channel for this form, else `fallback`. */
async function channelFor(
  payload: Payload,
  collection: keyof typeof ADMIN_CHANNEL_FIELD,
  fallback: string,
): Promise<string> {
  try {
    const settings = await payload.findGlobal({
      slug: 'site-content',
      depth: 0,
      overrideAccess: true,
    })
    return resolveSlackChannel(
      settings.slackChannels?.[ADMIN_CHANNEL_FIELD[collection]] ?? undefined,
      fallback,
    )
  } catch (error) {
    logger.error('Slack channel settings read failed', error)
    return fallback
  }
}

export async function notifyCollectionOnSlack(
  payload: Payload,
  args: {
    collection: 'donation-requests' | 'job-applications' | 'event-inquiries'
    id: string | number
    channel: string
    message: { text: string; blocks: Array<Record<string, unknown>> }
    failLog: string
  },
): Promise<void> {
  try {
    const posted = await slackApi('chat.postMessage', {
      channel: await channelFor(payload, args.collection, args.channel),
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
        : { slackError: 'Slack ping failed' },
    })
    if (!posted) logger.error(args.failLog)
  } catch (error) {
    logger.error(`${args.failLog} after()`, error)
  }
}
