/** Probes Payload and MongoDB readiness while classifying failures for internal logs. */

import { getPayload } from 'payload'
import { readServerEnvironment } from '@/lib/config/server-env'

export type HealthCheckStage = 'environment' | 'payload-init' | 'database-probe'

export class HealthCheckError extends Error {
  constructor(
    readonly stage: HealthCheckStage,
    cause: Error,
  ) {
    super(`Application health check failed during ${stage}`, { cause })
    this.name = 'HealthCheckError'
  }
}

/** Runs one probe phase and tags any failure with its stage. */
async function stage<T>(name: HealthCheckStage, run: () => Promise<T> | T): Promise<T> {
  try {
    return await run()
  } catch (error) {
    throw new HealthCheckError(
      name,
      error instanceof Error ? error : new Error('Unknown health check failure'),
    )
  }
}

export async function checkApplicationHealth(): Promise<void> {
  await stage('environment', () => readServerEnvironment())
  const config = await stage('payload-init', loadPayloadConfig)
  const payload = await stage('payload-init', () => getPayload({ config }))
  await stage('database-probe', async () => {
    const database = payload.db.collections.locations?.collection.conn.db
    if (!database) {
      throw new Error('Native MongoDB database handle is unavailable')
    }

    await database.command({ ping: 1 }, { timeoutMS: 5000 })
  })
}

async function loadPayloadConfig() {
  // Config loading is deferred so route initialization survives invalid deployment
  // configuration and GET can convert it to the public generic 503 response.
  const { default: config } = await import('@/src/payload.config')
  return config
}
