import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/src/payload.config'
import { revalidateForCollection } from '@/src/plugins/revalidation-plugin'
import { logger } from '@/lib/utils/logger'

const QUEUE = 'maintenance'

/**
 * Vercel invokes this route daily. Payload handles the schedule deduplication,
 * durable job record, retries, and execution; this route only wakes the queue.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const payload = await getPayload({ config })
    const scheduled = await payload.jobs.handleSchedules({ queue: QUEUE })
    const run = await payload.jobs.run({ queue: QUEUE, limit: 1, sequential: true })
    const ranJobs = Object.keys(run.jobStatus || {}).length

    // Job tasks intentionally avoid Next cache APIs so they also work from the
    // Payload CLI. In the Vercel runner, invalidate once after any execution.
    if (ranJobs > 0) {
      revalidateForCollection('beers')
    }

    return NextResponse.json({
      success: true,
      scheduled: {
        queued: scheduled.queued.length,
        skipped: scheduled.skipped.length,
        errored: scheduled.errored.length,
      },
      run,
    })
  } catch (error) {
    logger.error('Untappd jobs runner error:', error)
    return NextResponse.json({ error: 'Failed to run maintenance jobs' }, { status: 500 })
  }
}

export const maxDuration = 300
