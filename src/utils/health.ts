/** Probes the configured Payload application and MongoDB connection for readiness. */

import { getPayload } from 'payload'
import config from '@/src/payload.config'
import { readServerEnvironment } from '@/lib/config/server-env'

export async function checkApplicationHealth(): Promise<void> {
  readServerEnvironment()

  const payload = await getPayload({ config })
  await payload.find({
    collection: 'locations',
    limit: 1,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
}
