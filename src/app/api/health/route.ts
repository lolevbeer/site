/** Public, non-sensitive readiness endpoint for deployment monitoring. */

import { NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'
import { checkApplicationHealth, HealthCheckError } from '@/src/utils/health'

const headers = { 'Cache-Control': 'no-store' }

export async function GET() {
  try {
    await checkApplicationHealth()
    return NextResponse.json({ status: 'ok' }, { headers })
  } catch (error) {
    const stage = error instanceof HealthCheckError ? error.stage : 'unknown'
    const cause = error instanceof HealthCheckError ? error.cause : error
    logger.error('Application health check failed', cause, { stage })
    return NextResponse.json({ status: 'unhealthy' }, { status: 503, headers })
  }
}
