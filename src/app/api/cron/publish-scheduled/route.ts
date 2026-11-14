/**
 * Runs due scheduled-publish jobs (#370). Vercel calls this every five minutes
 * (vercel.json), so a beer or menu scheduled in the admin goes live within five
 * minutes of its time.
 *
 * Payload's schedule drawer queues a `schedulePublish` job in the `default`
 * queue with a `waitUntil`; this route only wakes that queue. Each job publishes
 * as the person who scheduled it, so collection access rules, the save hooks
 * (menu and kiosk revalidation) and "Last edited by" all apply.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/src/payload.config'
import { logger } from '@/lib/utils/logger'
import { isCronRequest } from '../authorize'

export async function GET(request: NextRequest) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const payload = await getPayload({ config })
    const run = await payload.jobs.run({
      queue: 'default',
      limit: 10,
      sequential: true,
      overrideAccess: true,
    })
    const statuses = Object.values(run.jobStatus || {})
    const success = statuses.every((job) => job.status === 'success')

    return NextResponse.json(
      { success, ran: statuses.length, run },
      { status: success ? 200 : 503 },
    )
  } catch (error) {
    logger.error('Scheduled publish runner error:', error)
    return NextResponse.json({ error: 'Failed to run scheduled publishes' }, { status: 500 })
  }
}

export const maxDuration = 60
