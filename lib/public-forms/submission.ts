import { createHash } from 'node:crypto'
import type { Payload, RequiredDataFromCollectionSlug } from 'payload'
import { reserveIpHashSlot } from './durable-limit'

type FormCollection = 'donation-requests' | 'job-applications'

/** Exact normalized content is one submission; changed content is a distinct request. */
export async function savePublicForm<C extends FormCollection>(
  payload: Payload,
  collection: C,
  data: RequiredDataFromCollectionSlug<C>,
  ipHash: string,
) {
  const submissionKey = createHash('sha256').update(JSON.stringify(data)).digest('hex')
  const findExisting = () =>
    payload.find({
      collection,
      where: { submissionKey: { equals: submissionKey } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
  if ((await findExisting()).docs.length) return { status: 'duplicate' as const }
  const release = await reserveIpHashSlot(payload, collection, ipHash)
  if (!release) return { status: 'limited' as const }
  try {
    const doc = await payload.create({
      collection,
      data: { ...data, ipHash, submissionKey },
      overrideAccess: true,
    })
    return { status: 'created' as const, doc }
  } catch (error) {
    await release()
    // A unique-index loser may report success only when the winning record exists.
    if ((await findExisting()).docs.length) return { status: 'duplicate' as const }
    throw error
  }
}
