'use server'

/**
 * "Send test message" for Admin → Site Content → Slack Channels. Admins only.
 * Posts to the channel typed in the field (saved or not); blank or invalid
 * falls back to the same env/default channel the live form pings use.
 */

import { getPayload } from 'payload'
import { headers } from 'next/headers'
import config from '@payload-config'
import { isAdmin } from '@/src/access/roles'
import type { User } from '@/src/payload-types'
import { resolveSlackChannel } from '@/lib/slack/mrkdwn'
import { donationSlackChannel } from '@/lib/donate/slack-message'
import { jobApplicationSlackChannel } from '@/lib/jobs/slack-message'
import { eventInquirySlackChannel } from '@/lib/events/inquiry-slack'
import { slackApi } from '@/src/utils/slack-api'

const FORMS = {
  donations: ['Donation requests', donationSlackChannel],
  jobs: ['Job applications', jobApplicationSlackChannel],
  eventInquiries: ['Private-event inquiries', eventInquirySlackChannel],
} as const

export type SlackTestForm = keyof typeof FORMS

export async function sendSlackTestMessage(
  form: SlackTestForm,
  channel: string,
): Promise<{ ok: boolean; channel: string | null }> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!isAdmin(user as User | null) || !Object.hasOwn(FORMS, form)) {
    return { ok: false, channel: null }
  }

  const [label, fallback] = FORMS[form]
  const target = resolveSlackChannel(channel, fallback())
  const ok = await slackApi('chat.postMessage', {
    channel: target,
    text: `Test from lolev.beer: ${label} pings will post here.`,
  })
  return { ok, channel: target }
}
