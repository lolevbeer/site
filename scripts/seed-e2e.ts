/** Seeds the disposable release-smoke database through Payload's local API. */
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { isDisposableDatabase } from './e2e-database-guard'

const databaseUri = process.env.DATABASE_URI
const email = process.env.E2E_ADMIN_EMAIL
const password = process.env.E2E_ADMIN_PASSWORD

if (!databaseUri || !isDisposableDatabase(databaseUri, process.env.E2E_DISPOSABLE_DATABASE)) {
  throw new Error('E2E seeding requires a disposable database target')
}

if (!email || !password) {
  throw new Error('E2E seeding requires E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD')
}

const database = new URL(databaseUri)
const databaseClassification = ['localhost', '127.0.0.1', '[::1]'].includes(database.hostname)
  ? 'local'
  : 'explicit-remote'
const payload = await getPayload({ config })

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

const faqs = await payload.find({
  collection: 'faqs',
  where: { question: { equals: 'Production readiness fixture' } },
  limit: 1,
})
const faq = faqs.docs[0]
  ? await payload.update({
      collection: 'faqs',
      id: faqs.docs[0].id,
      data: { active: true, answer: 'Initial release fixture answer', order: 9999 },
    })
  : await payload.create({
      collection: 'faqs',
      data: {
        active: true,
        answer: 'Initial release fixture answer',
        order: 9999,
        question: 'Production readiness fixture',
      },
    })

console.log(`E2E seed: admin=${admin.id}; faq=${faq.id}; database=${databaseClassification}`)
