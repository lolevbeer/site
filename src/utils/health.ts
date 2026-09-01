/** Probes Payload and MongoDB readiness while classifying failures for internal logs. */

import { getPayload } from 'payload'
import { readServerEnvironment } from '@/lib/config/server-env'

export type HealthCheckStage = 'environment' | 'payload-init' | 'database-probe'

export class HealthCheckError extends Error {
  constructor(readonly stage: HealthCheckStage) {
    super(`Application health check failed during ${stage}`)
    this.name = 'HealthCheckError'
  }
}

export async function checkApplicationHealth(): Promise<void> {
  try {
    readServerEnvironment()
  } catch {
    throw new HealthCheckError('environment')
  }

  let config: Awaited<ReturnType<typeof loadPayloadConfig>>
  try {
    config = await loadPayloadConfig()
  } catch {
    throw new HealthCheckError('payload-init')
  }

  let payload: Awaited<ReturnType<typeof getPayload>>
  try {
    payload = await getPayload({ config })
  } catch {
    throw new HealthCheckError('payload-init')
  }
  try {
    const database = payload.db.collections.locations?.collection.conn.db
    if (!database) {
      throw new Error('Native MongoDB database handle is unavailable')
    }

    await database.command({ ping: 1 }, { timeoutMS: 5000 })
  } catch {
    throw new HealthCheckError('database-probe')
  }
}

async function loadPayloadConfig() {
  // Config loading is deferred so route initialization survives invalid deployment
  // configuration and GET can convert it to the public generic 503 response.
  const { default: config } = await import('@/src/payload.config')
  return config
}
