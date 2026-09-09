'use server'

/**
 * Public job apply. Validates, stores the row, pings Slack #events in after().
 *
 * Untrusted input: `unknown`. Honeypot spam returns `{ ok: true }` without a
 * write. Slack is best-effort.
 */

import { after } from 'next/server'
import { getPayload } from 'payload'
import config from '@/src/payload.config'
import { logger } from '@/lib/utils/logger'
import { readServerEnvironment } from '@/lib/config/server-env'
import {
  readJobApplicationInput,
  validateJobApplication,
  type JobApplicationErrors,
} from '@/lib/jobs/application'
import { buildJobApplicationSlackMessage, jobApplicationSlackChannel } from '@/lib/jobs/slack-message'
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

export type SubmitJobApplicationResult =
  | { ok: true }
  | { ok: false; error: string; errors?: JobApplicationErrors }

function fail(error: string, errors?: JobApplicationErrors): SubmitJobApplicationResult {
  return { ok: false, error, errors }
}

export async function submitJobApplication(input: unknown): Promise<SubmitJobApplicationResult> {
  try {
    const parsed = readJobApplicationInput(input)
    if (!parsed) return fail(PUBLIC_FORM_INCOMPLETE)
    if (isHoneypotFilled(parsed.companyUrlHp)) return { ok: true }

    const result = validateJobApplication(parsed)
    if (result.ok && result.spam) return { ok: true }
    if (!result.ok) return fail(firstFieldError(result.errors), result.errors)

    const ip = await clientIp()
    if (!allowIpAttempt('jobs', ip)) return fail(PUBLIC_FORM_IP_LIMIT_MESSAGE)

    const email = parsed.email.trim().toLowerCase()
    if (!allowEmailAttempt('jobs', email)) return fail(PUBLIC_FORM_EMAIL_LIMIT_MESSAGE)

    const payload = await getPayload({ config })
    const ipHash = hashSubmitterIp(ip, readServerEnvironment().payloadSecret)
    if (await hasReachedIpHashLimit(payload, 'job-applications', ipHash)) {
      return fail(PUBLIC_FORM_IP_LIMIT_MESSAGE)
    }

    const jobs = await payload.find({
      collection: 'jobs',
      where: {
        and: [{ slug: { equals: parsed.jobSlug.trim() } }, { active: { equals: true } }],
      },
      limit: 1,
      depth: 1,
    })
    const job = jobs.docs[0]
    if (!job) return fail('That opening is no longer listed.')

    const recent = await payload.find({
      collection: 'job-applications',
      where: {
        and: [{ email: { equals: parsed.email.trim() } }, { job: { equals: job.id } }],
      },
      limit: 1,
      overrideAccess: true,
    })
    if (isRecentTimestamp(recent.docs[0]?.createdAt, PUBLIC_FORM_EMAIL_WINDOW_MS)) {
      return { ok: true }
    }

    const created = await payload.create({
      collection: 'job-applications',
      overrideAccess: true,
      data: {
        job: job.id,
        name: parsed.name.trim(),
        email: parsed.email.trim(),
        phone: parsed.phone.trim(),
        message: parsed.message.trim(),
        ipHash,
      },
    })

    const locationName =
      typeof job.location === 'object' && job.location && 'name' in job.location
        ? String(job.location.name)
        : 'Taproom'

    after(() =>
      notifyCollectionOnSlack(payload, {
        collection: 'job-applications',
        id: created.id,
        channel: jobApplicationSlackChannel(),
        message: buildJobApplicationSlackMessage({
          jobTitle: job.title,
          locationName,
        }),
        failLog: 'Job application Slack ping failed',
      }),
    )

    return { ok: true }
  } catch (error) {
    logger.error('Job application save failed', error)
    return fail('Could not submit the application. Try again in a minute.')
  }
}
