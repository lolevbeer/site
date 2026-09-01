/** Seeds the disposable release-smoke database through Payload's local API. */
import { isDisposableDatabase, isLoopbackHost } from './e2e-database-guard'

export async function runSeed(): Promise<void> {
  const databaseUri = process.env.DATABASE_URI
  const email = process.env.E2E_ADMIN_EMAIL
  const password = process.env.E2E_ADMIN_PASSWORD

  if (!databaseUri || !isDisposableDatabase(databaseUri, process.env.E2E_DISPOSABLE_DATABASE)) {
    throw new Error('E2E seeding requires a disposable database target')
  }

  if (process.env.PAYLOAD_DROP_DATABASE?.trim().toLowerCase() === 'true') {
    throw new Error('E2E seeding refuses PAYLOAD_DROP_DATABASE=true')
  }

  if (!email || !password) {
    throw new Error('E2E seeding requires E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD')
  }

  const database = new URL(databaseUri)
  const databaseClassification = isLoopbackHost(database.hostname)
    ? 'local'
    : 'explicit-remote'
  // These imports run only after all environment guards; static config loading
  // would initialize Payload configuration even for a rejected seed target.
  const [{ getPayload }, { default: config }] = await Promise.all([
    import('payload'),
    import('@/src/payload.config'),
  ])
  const payload = await getPayload({ config })

  const faqs = await payload.find({
    collection: 'faqs',
    where: { question: { equals: 'Production readiness fixture' } },
    limit: 2,
  })
  if (faqs.docs.length > 1) {
    throw new Error('E2E seeding found duplicate release-smoke FAQ fixtures')
  }

  const users = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
  })
  const admin = users.docs[0]
    ? await payload.update({
        collection: 'users',
        id: users.docs[0].id,
        data: { password, roles: ['admin'] },
      })
    : await payload.create({
        collection: 'users',
        data: { email, password, roles: ['admin'] },
      })

  const faq = faqs.docs[0]
    ? await payload.update({
        collection: 'faqs',
        id: faqs.docs[0].id,
        data: { active: true, answer: 'Initial release fixture answer', order: 9999 },
        context: { skipRevalidate: true },
      })
    : await payload.create({
        collection: 'faqs',
        data: {
          active: true,
          answer: 'Initial release fixture answer',
          order: 9999,
          question: 'Production readiness fixture',
        },
        context: { skipRevalidate: true },
      })

  console.log(`E2E seed: admin=${admin.id}; faq=${faq.id}; database=${databaseClassification}`)
}

await runSeed()
