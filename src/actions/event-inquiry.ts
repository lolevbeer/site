'use server'

/**
 * Public private-event inquiry from /private-events. Validates, stores the row in the
 * `event-inquiries` staff inbox (never Events), and pings Slack #events in
 * after() so a slow Slack cannot stall the thank-you.
 *
 * Untrusted input: `unknown`. Honeypot spam and exact-content retries return
 * `{ ok: true }` without a write. Slack is best-effort.
 */

import { after } from 'next/server'
import { getPayload } from 'payload'
import config from '@/src/payload.config'
import { logger } from '@/lib/utils/logger'
import { readServerEnvironment } from '@/lib/config/server-env'
import {
  readEventInquiryInput,
  validateEventInquiry,
  type EventInquiryErrors,
} from '@/lib/events/inquiry'
import { buildEventInquirySlackMessage, eventInquirySlackChannel } from '@/lib/events/inquiry-slack'
import { firstFieldError, PUBLIC_FORM_INCOMPLETE } from '@/lib/public-forms/fields'
import { isHoneypotFilled } from '@/lib/public-forms/honeypot'
import { clientIp } from '@/lib/public-forms/request-ip'
import { hashSubmitterIp } from '@/lib/public-forms/ip-hash'
import { savePublicForm } from '@/lib/public-forms/submission'
import { findActiveTaprooms } from '@/lib/public-forms/taprooms'
import { PUBLIC_FORM_IP_LIMIT_MESSAGE } from '@/lib/public-forms/rate-limit'
import { toESTDate } from '@/lib/utils/date'
import { notifyCollectionOnSlack } from '@/lib/slack/notify'

export type SubmitEventInquiryResult =
  { ok: true } | { ok: false; error: string; errors?: EventInquiryErrors }

function fail(error: string, errors?: EventInquiryErrors): SubmitEventInquiryResult {
  return { ok: false, error, errors }
}

export async function submitEventInquiry(input: unknown): Promise<SubmitEventInquiryResult> {
  try {
    const parsed = readEventInquiryInput(input)
    if (!parsed) return fail(PUBLIC_FORM_INCOMPLETE)
    if (isHoneypotFilled(parsed.companyUrlHp)) return { ok: true }

    const ip = await clientIp()

    const payload = await getPayload({ config })
    const taprooms = await findActiveTaprooms(payload)
    const result = validateEventInquiry(
      parsed,
      undefined,
      taprooms.map((doc) => doc.slug),
    )
    if (result.ok && result.spam) return { ok: true }
    if (!result.ok) return fail(firstFieldError(result.errors), result.errors)

    const value = result.value
    const ipHash = hashSubmitterIp(ip, readServerEnvironment().payloadSecret)

    // The validator only accepts slugs from `taprooms`, so this always matches.
    const taproom = taprooms.find((doc) => doc.slug === value.taproom)!
    // Noon Eastern: a midnight-UTC day shows as the previous day in the
    // admin's dayOnly picker for Pittsburgh staff.
    const preferredDate = toESTDate(value.preferredDate).toISOString()

    const saved = await savePublicForm(
      payload,
      'event-inquiries',
      {
        status: 'new',
        name: value.name,
        email: value.email,
        phone: value.phone || undefined,
        preferredDate,
        headcount: value.headcount,
        taproom: taproom.id,
        message: value.message || undefined,
      },
      ipHash,
    )
    if (saved.status === 'limited') return fail(PUBLIC_FORM_IP_LIMIT_MESSAGE)
    if (saved.status === 'duplicate') return { ok: true }
    const created = saved.doc

    after(() =>
      notifyCollectionOnSlack(payload, {
        collection: 'event-inquiries',
        id: created.id,
        channel: eventInquirySlackChannel(),
        message: buildEventInquirySlackMessage({
          preferredDate: value.preferredDate,
          headcount: value.headcount,
          taproomName: taproom.name || value.taproom,
        }),
        failLog: 'Event inquiry Slack ping failed',
      }),
    )

    return { ok: true }
  } catch (error) {
    logger.error('Event inquiry submit failed', error)
    return fail('Could not send the inquiry. Try again in a minute.')
  }
}
