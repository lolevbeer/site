'use server'

/**
 * "Send test message" for Admin → Site Content → Slack Channels. Admins only.
 * Posts to the channel typed in the field (saved or not); a blank field tests
 * the env/default channel the live form pings use.
 *
 * Result: `ok` true when Slack accepted the post. Otherwise `reason` says why:
 * `forbidden` (not an admin or unknown form), `invalid` (typed value is not a
 * `#name` or C…/G… id), `not-configured` (no bot token on this server), or
 * `refused` (Slack rejected the post, usually the bot is not in the channel,
 * or Slack was unreachable). `channel` is the channel tried, when known.
 */

import { getPayload } from 'payload'
import { headers } from 'next/headers'
import config from '@payload-config'
import { isAdmin } from '@/src/access/roles'
import type { User } from '@/src/payload-types'
import { readServerEnvironment } from '@/lib/config/server-env'
import { isSlackChannel } from '@/lib/slack/mrkdwn'
import { donationSlackChannel } from '@/lib/donate/slack-message'
import { jobApplicationSlackChannel } from '@/lib/jobs/slack-message'
import { eventInquirySlackChannel } from '@/lib/events/inquiry-slack'
import { slackApi } from '@/src/utils/slack-api'

/** Slack Channels field name → label and live fallback channel. */
const FORMS = {
  donations: ['Donation requests', donationSlackChannel],
  jobs: ['Job applications', jobApplicationSlackChannel],
  eventInquiries: ['Private-event inquiries', eventInquirySlackChannel],
} as const

export type SlackTestForm = keyof typeof FORMS

export type SlackTestResult =
  | { ok: true; channel: string }
  | { ok: false; reason: 'forbidden' | 'invalid' | 'not-configured'; channel?: undefined }
  | { ok: false; reason: 'refused'; channel: string }

function hasBotToken(): boolean {
  try {
    return Boolean(readServerEnvironment().slackBotToken)
  } catch {
    return false
  }
}

export async function sendSlackTestMessage(
  form: SlackTestForm,
  channel: string,
): Promise<SlackTestResult> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!isAdmin(user as User | null) || !Object.hasOwn(FORMS, form)) {
    return { ok: false, reason: 'forbidden' }
  }

  const typed = typeof channel === 'string' ? channel.trim() : ''
  // Match the field validator: test what would save, never swap in a default.
  if (typed && !isSlackChannel(typed)) return { ok: false, reason: 'invalid' }
  if (!hasBotToken()) return { ok: false, reason: 'not-configured' }

  const [label, fallback] = FORMS[form]
  const target = typed || fallback()
  const posted = await slackApi('chat.postMessage', {
    channel: target,
    text: `Test from lolev.beer: the bot can post ${label} pings here.`,
  })
  return posted ? { ok: true, channel: target } : { ok: false, reason: 'refused', channel: target }
}
