/** Public, non-sensitive readiness endpoint for deployment monitoring. */

import { NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'
import { checkApplicationHealth } from '@/src/utils/health'

const headers = { 'Cache-Control': 'no-store' }

export async function GET() {
  try {
    await checkApplicationHealth()
    return NextResponse.json({ status: 'ok' }, { headers })
  } catch {
    logger.error('Application health check failed')
    return NextResponse.json({ status: 'unhealthy' }, { status: 503, headers })
  }
}
