/** Probes Payload and MongoDB readiness while exposing only allowlisted failure stages. */

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
    await payload.find({
      collection: 'locations',
      limit: 1,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
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
