'use server'

/**
 * Public private-event inquiry from /events. Validates, stores the row in the
 * `event-inquiries` staff inbox (never Events), and pings Slack #events in
 * after() so a slow Slack cannot stall the thank-you.
 *
 * Untrusted input: `unknown`. Honeypot spam and recent duplicates return
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
import { hasReachedIpHashLimit } from '@/lib/public-forms/durable-limit'
import { findActiveTaprooms } from '@/lib/public-forms/taprooms'
import {
  PUBLIC_FORM_EMAIL_LIMIT_MESSAGE,
  PUBLIC_FORM_EMAIL_WINDOW_MS,
  PUBLIC_FORM_IP_LIMIT_MESSAGE,
  allowEmailAttempt,
  allowIpAttempt,
} from '@/lib/public-forms/rate-limit'
import { isRecentTimestamp, toESTDate } from '@/lib/utils/date'
import { notifyCollectionOnSlack } from '@/lib/slack/notify'

export type SubmitEventInquiryResult =
  | { ok: true }
  | { ok: false; error: string; errors?: EventInquiryErrors }

function fail(error: string, errors?: EventInquiryErrors): SubmitEventInquiryResult {
  return { ok: false, error, errors }
}

export async function submitEventInquiry(input: unknown): Promise<SubmitEventInquiryResult> {
  try {
    const parsed = readEventInquiryInput(input)
    if (!parsed) return fail(PUBLIC_FORM_INCOMPLETE)
    if (isHoneypotFilled(parsed.companyUrlHp)) return { ok: true }

    const ip = await clientIp()
    if (!allowIpAttempt('event-inquiry', ip)) return fail(PUBLIC_FORM_IP_LIMIT_MESSAGE)

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
    // The validator lowercases email, so the rate limit and duplicate check match.
    if (!allowEmailAttempt('event-inquiry', value.email)) {
      return fail(PUBLIC_FORM_EMAIL_LIMIT_MESSAGE)
    }

    const ipHash = hashSubmitterIp(ip, readServerEnvironment().payloadSecret)
    if (await hasReachedIpHashLimit(payload, 'event-inquiries', ipHash)) {
      return fail(PUBLIC_FORM_IP_LIMIT_MESSAGE)
    }

    // The validator only accepts slugs from `taprooms`, so this always matches.
    const taproom = taprooms.find((doc) => doc.slug === value.taproom)!
    // Noon Eastern: a midnight-UTC day shows as the previous day in the
    // admin's dayOnly picker for Pittsburgh staff.
    const preferredDate = toESTDate(value.preferredDate).toISOString()

    const recent = await payload.find({
      collection: 'event-inquiries',
      where: {
        and: [
          { email: { equals: value.email } },
          { preferredDate: { equals: preferredDate } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    })
    if (isRecentTimestamp(recent.docs[0]?.createdAt, PUBLIC_FORM_EMAIL_WINDOW_MS)) {
      return { ok: true }
    }

    const created = await payload.create({
      collection: 'event-inquiries',
      overrideAccess: true,
      data: {
        status: 'new',
        name: value.name,
        email: value.email,
        phone: value.phone,
        preferredDate,
        headcount: value.headcount,
        taproom: taproom.id,
        message: value.message || undefined,
        ipHash,
      },
    })

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
        failLog: 'Event inquiry Slack ping to #events failed',
      }),
    )

    return { ok: true }
  } catch (error) {
    logger.error('Event inquiry submit failed', error)
    return fail('Could not send the inquiry. Try again in a minute.')
  }
}
