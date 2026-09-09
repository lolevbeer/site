/**
 * Best-effort Slack ping after a public form write. Records success or
 * failure on the inbox row. Unfurls are off so submitted text cannot fetch
 * arbitrary URLs in Slack.
 */

import type { Payload } from 'payload'
import { logger } from '@/lib/utils/logger'
import { slackApi } from '@/src/utils/slack-api'

export async function notifyCollectionOnSlack(
  payload: Payload,
  args: {
    collection: 'donation-requests' | 'job-applications'
    id: string | number
    channel: string
    message: { text: string; blocks: Array<Record<string, unknown>> }
    failLog: string
  },
): Promise<void> {
  try {
    const posted = await slackApi('chat.postMessage', {
      channel: args.channel,
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
