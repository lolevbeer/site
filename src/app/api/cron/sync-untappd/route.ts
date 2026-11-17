import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/src/payload.config'
import { revalidateForCollection } from '@/src/plugins/revalidation-plugin'
import { syncUntappdRatingsTask } from '@/src/jobs/sync-untappd-ratings'
import { logger } from '@/lib/utils/logger'
import { isCronRequest } from '../authorize'

const QUEUE = 'maintenance'

/**
 * Vercel wakes this queue every five minutes from 06:00 to 07:55 UTC (vercel.json): the Untappd sync is scheduled for
 * 06:00 and the Google hours check for 06:30, and their retries finish well inside that window. Payload handles the
 * schedule deduplication, durable job record, retries, and execution; this route only wakes the queue. Move the cron
 * window with any new task's schedule.
 *
 * Each wake runs at most one Untappd job and one job of any other task, as two runs, so the route knows whether the
 * Untappd sync ran: only that one changes beers and needs their caches refreshed.
 */
export async function GET(request: NextRequest) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const payload = await getPayload({ config })
    const scheduled = await payload.jobs.handleSchedules({ queue: QUEUE })
    const runOne = (operator: 'equals' | 'not_equals') =>
      payload.jobs.run({
        queue: QUEUE,
        limit: 1,
        sequential: true,
        overrideAccess: true,
        where: { taskSlug: { [operator]: syncUntappdRatingsTask.slug } },
      })
    const untappd = await runOne('equals')
    const others = await runOne('not_equals')
    const run = { jobStatus: { ...untappd.jobStatus, ...others.jobStatus } }

    // Job tasks avoid Next cache APIs so they also work from the Payload CLI.
    // In the Vercel runner, invalidate beers once after an Untappd sync — the
    // batch shape (menus tag, `/beer/[variant]`) lives in the revalidation
    // plugin so this route and the sheet sync can't drift apart.
    if (Object.keys(untappd.jobStatus || {}).length > 0) {
      revalidateForCollection('beers')
    }

    const success =
      scheduled.errored.length === 0 &&
      Object.values(run.jobStatus).every((job) => job.status === 'success')
    return NextResponse.json(
      {
        success,
        scheduled: {
          queued: scheduled.queued.length,
          skipped: scheduled.skipped.length,
          errored: scheduled.errored.length,
        },
        run,
      },
      { status: success ? 200 : 503 },
    )
  } catch (error) {
    logger.error('Maintenance jobs runner error:', error)
    return NextResponse.json({ error: 'Failed to run maintenance jobs' }, { status: 500 })
  }
}

export const maxDuration = 300
