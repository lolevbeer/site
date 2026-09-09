'use server'

/**
 * Public donation-request submit. Validates the ringer, stores the row for
 * staff, and pings Slack #events in after() so a slow Slack cannot stall the
 * thank-you screen.
 *
 * Untrusted input: `unknown`. `{ ok: true }` is also returned for honeypot
 * spam (nothing is stored). Slack is best-effort and is not part of the
 * user-facing result.
 */

import { after } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@/src/payload.config'
import { logger } from '@/lib/utils/logger'
import { readServerEnvironment } from '@/lib/config/server-env'
import {
  firstDonationErrorStep,
  readDonationRequestInput,
  validateDonationRequest,
  type DonationRequestErrors,
  type ValidatedDonationRequest,
} from '@/lib/donate/donation-request'
import { buildDonationSlackMessage, donationSlackChannel } from '@/lib/donate/slack-message'
import { firstFieldError, PUBLIC_FORM_INCOMPLETE } from '@/lib/public-forms/fields'
import { isHoneypotFilled } from '@/lib/public-forms/honeypot'
import { clientIp } from '@/lib/public-forms/request-ip'
import { hashSubmitterIp } from '@/lib/public-forms/ip-hash'
import { hasReachedIpHashLimit } from '@/lib/public-forms/durable-limit'
import {
  PUBLIC_FORM_EMAIL_LIMIT_MESSAGE,
  PUBLIC_FORM_EMAIL_WINDOW_MS,
  PUBLIC_FORM_IP_LIMIT_MESSAGE,
  allowEmailAttempt,
  allowIpAttempt,
  isRecentTimestamp,
} from '@/lib/public-forms/rate-limit'
import { notifyCollectionOnSlack } from '@/lib/slack/notify'

export type SubmitDonationResult =
  | { ok: true }
  | { ok: false; error: string; errors?: DonationRequestErrors; step?: 1 | 2 | 3 }

function fail(error: string, errors?: DonationRequestErrors): SubmitDonationResult {
  return {
    ok: false,
    error,
    errors,
    step: errors ? firstDonationErrorStep(errors) : undefined,
  }
}

function persistData(input: ValidatedDonationRequest, ipHash: string) {
  return {
    status: 'new' as const,
    askType: input.askType,
    organizationName: input.organizationName,
    contactName: input.contactName,
    email: input.email,
    phone: input.phone,
    mission: input.mission,
    howHeard: input.howHeard,
    previousDonation: input.previousDonation,
    eventName: input.eventName,
    eventDate: input.eventDate,
    venue: input.venue,
    attendees: input.attendees,
    requestDetails: input.requestDetails,
    recognition: input.recognition,
    whyLolev: input.whyLolev,
    howServed: input.askType === 'product' ? input.howServed : undefined,
    pickupName: input.askType === 'product' ? input.pickupName : undefined,
    taproom: input.askType === 'taproom-night' ? input.taproom : undefined,
    ipHash,
  }
}

async function activeTaproomSlugs(payload: Payload): Promise<string[]> {
  const result = await payload.find({
    collection: 'locations',
    where: { active: { not_equals: false } },
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs
    .map((doc) => doc.slug)
    .filter((slug): slug is string => typeof slug === 'string' && slug.length > 0)
}

/**
 * @param input Untrusted Server Action payload. Non-objects return `{ ok: false }`.
 * @returns `{ ok: true }` on persist, honeypot, or recent duplicate. Errors include
 *   the first message plus the field map so the wizard can jump to the failing step.
 */
export async function submitDonationRequest(input: unknown): Promise<SubmitDonationResult> {
  try {
    const parsed = readDonationRequestInput(input)
    if (!parsed) return fail(PUBLIC_FORM_INCOMPLETE)
    if (isHoneypotFilled(parsed.companyUrlHp)) return { ok: true }

    const ip = await clientIp()
    if (!allowIpAttempt('donate', ip)) return fail(PUBLIC_FORM_IP_LIMIT_MESSAGE)

    const payload = await getPayload({ config })
    const result = validateDonationRequest(parsed, undefined, await activeTaproomSlugs(payload))
    if (result.ok && result.spam) return { ok: true }
    if (!result.ok) return fail(firstFieldError(result.errors), result.errors)

    const value = result.value
    const email = value.email.toLowerCase()
    if (!allowEmailAttempt('donate', email)) return fail(PUBLIC_FORM_EMAIL_LIMIT_MESSAGE)

    const ipHash = hashSubmitterIp(ip, readServerEnvironment().payloadSecret)
    if (await hasReachedIpHashLimit(payload, 'donation-requests', ipHash)) {
      return fail(PUBLIC_FORM_IP_LIMIT_MESSAGE)
    }

    const recent = await payload.find({
      collection: 'donation-requests',
      where: {
        and: [
          { email: { equals: value.email } },
          { eventDate: { equals: value.eventDate } },
          { eventName: { equals: value.eventName } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    })
    if (isRecentTimestamp(recent.docs[0]?.createdAt, PUBLIC_FORM_EMAIL_WINDOW_MS)) {
      return { ok: true }
    }

    const created = await payload.create({
      collection: 'donation-requests',
      overrideAccess: true,
      data: persistData(value, ipHash),
    })

    after(() =>
      notifyCollectionOnSlack(payload, {
        collection: 'donation-requests',
        id: created.id,
        channel: donationSlackChannel(),
        message: buildDonationSlackMessage(value),
        failLog: 'Donation request Slack ping to #events failed',
      }),
    )

    return { ok: true }
  } catch (error) {
    logger.error('Donation request submit failed', error)
    return fail('Could not submit the request. Try again in a minute.')
  }
}
