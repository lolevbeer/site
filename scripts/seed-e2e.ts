/** Seeds the disposable release-smoke database through Payload's local API. */
import { isDropDatabaseEnabled } from '@/lib/config/server-env'
import { isDisposableDatabase, isLoopbackHost } from './e2e-database-guard'

export async function runSeed(): Promise<void> {
  const databaseUri = process.env.DATABASE_URI
  const email = process.env.E2E_ADMIN_EMAIL
  const password = process.env.E2E_ADMIN_PASSWORD

  if (!databaseUri || !isDisposableDatabase(databaseUri, process.env.E2E_DISPOSABLE_DATABASE)) {
    throw new Error('E2E seeding requires a disposable database target')
  }

  if (isDropDatabaseEnabled()) {
    throw new Error('E2E seeding refuses PAYLOAD_DROP_DATABASE=true')
  }

  if (!email || !password) {
    throw new Error('E2E seeding requires E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD')
  }

  const database = new URL(databaseUri)
  const databaseClassification = isLoopbackHost(database.hostname) ? 'local' : 'explicit-remote'
  // These imports run only after all environment guards; static config loading
  // would initialize Payload configuration even for a rejected seed target.
  const [{ getPayload }, { default: config }] = await Promise.all([
    import('payload'),
    import('@/src/payload.config'),
  ])
  const payload = await getPayload({ config })

  const faqs = await payload.find({
    collection: 'faqs',
    overrideAccess: true,
    where: { question: { equals: 'Production readiness fixture' } },
    limit: 2,
  })
  if (faqs.docs.length > 1) {
    throw new Error('E2E seeding found duplicate release-smoke FAQ fixtures')
  }

  // Reserved keys keep reruns scoped to these fixtures. Check every collection
  // before the first write so ambiguous identities cannot partially seed data.
  const locations = await payload.find({
    collection: 'locations',
    overrideAccess: true,
    where: { name: { equals: 'Lolev Release Smoke' } },
    limit: 2,
  })
  const styles = await payload.find({
    collection: 'styles',
    overrideAccess: true,
    where: { name: { equals: 'Release Smoke Style' } },
    limit: 2,
  })
  const beers = await payload.find({
    collection: 'beers',
    overrideAccess: true,
    where: { slug: { equals: 'release-smoke-beer' } },
    limit: 2,
  })
  const menus = await payload.find({
    collection: 'menus',
    overrideAccess: true,
    where: { url: { equals: 'release-smoke-location-draft' } },
    limit: 2,
  })
  const jobs = await payload.find({
    collection: 'jobs',
    overrideAccess: true,
    where: { slug: { equals: 'release-smoke-job' } },
    limit: 2,
  })

  const users = await payload.find({
    collection: 'users',
    overrideAccess: true,
    where: { email: { equals: email } },
    limit: 2,
  })
  for (const [collection, result] of [
    ['locations', locations],
    ['styles', styles],
    ['beers', beers],
    ['menus', menus],
    ['jobs', jobs],
    ['users', users],
  ] as const) {
    if (result.docs.length > 1) {
      throw new Error(`E2E seeding found duplicate release-smoke ${collection} fixtures`)
    }
  }

  const locationData = {
    name: 'Lolev Release Smoke',
    slug: 'lolev-release-smoke',
    active: true,
    timezone: 'America/New_York',
    address: { street: '1 Fixture Way', city: 'Pittsburgh', state: 'PA', zip: '15201' },
  } as const
  const location = locations.docs[0]
    ? await payload.update({
        collection: 'locations',
        id: locations.docs[0].id,
        data: locationData,
        overrideAccess: true,
        context: { skipRevalidate: true },
      })
    : await payload.create({
        collection: 'locations',
        data: locationData,
        overrideAccess: true,
        context: { skipRevalidate: true },
      })
  const style = styles.docs[0]
    ? await payload.update({
        collection: 'styles',
        id: styles.docs[0].id,
        data: { name: 'Release Smoke Style' },
        overrideAccess: true,
        context: { skipRevalidate: true },
      })
    : await payload.create({
        collection: 'styles',
        data: { name: 'Release Smoke Style' },
        overrideAccess: true,
        context: { skipRevalidate: true },
      })
  // Leave recipe assignment to the beer hook; omit Untappd to avoid external calls.
  const beerData = {
    name: 'Release Smoke Beer',
    slug: 'release-smoke-beer',
    style: style.id,
    glass: 'pint',
    abv: 5,
    draftPrice: 7,
    description: 'Disposable release smoke beer fixture.',
    hideFromSite: false,
    _status: 'published',
  } as const
  const beer = beers.docs[0]
    ? await payload.update({
        collection: 'beers',
        id: beers.docs[0].id,
        data: beerData,
        overrideAccess: true,
        context: { skipRevalidate: true },
      })
    : await payload.create({
        collection: 'beers',
        data: beerData,
        overrideAccess: true,
        context: { skipRevalidate: true },
      })
  const menuData = {
    name: 'Release Smoke Draft Menu',
    url: 'release-smoke-location-draft',
    type: 'draft' as const,
    location: location.id,
    _status: 'published' as const,
    items: [{ product: { relationTo: 'beers' as const, value: beer.id } }],
  }
  const menu = menus.docs[0]
    ? await payload.update({
        collection: 'menus',
        id: menus.docs[0].id,
        data: menuData,
        overrideAccess: true,
        context: { skipRevalidate: true },
      })
    : await payload.create({
        collection: 'menus',
        data: menuData,
        overrideAccess: true,
        context: { skipRevalidate: true },
      })
  // The homepage and location page use the selected menu, not any matching menu.
  await payload.update({
    collection: 'locations',
    id: location.id,
    data: { draftMenu: menu.id },
    overrideAccess: true,
    context: { skipRevalidate: true },
  })
  const jobData = {
    title: 'Release Smoke Job',
    slug: 'release-smoke-job',
    location: location.id,
    active: true,
    description: 'Disposable release smoke job fixture.',
  }
  if (jobs.docs[0]) {
    await payload.update({
      collection: 'jobs',
      id: jobs.docs[0].id,
      data: jobData,
      overrideAccess: true,
      context: { skipRevalidate: true },
    })
  } else {
    await payload.create({
      collection: 'jobs',
      data: jobData,
      overrideAccess: true,
      context: { skipRevalidate: true },
    })
  }

  const admin = users.docs[0]
    ? await payload.update({
        collection: 'users',
        overrideAccess: true,
        id: users.docs[0].id,
        data: { password, roles: ['admin'] },
        context: { skipRevalidate: true },
      })
    : await payload.create({
        collection: 'users',
        overrideAccess: true,
        data: { email, password, roles: ['admin'] },
        context: { skipRevalidate: true },
      })

  const faq = faqs.docs[0]
    ? await payload.update({
        collection: 'faqs',
        overrideAccess: true,
        id: faqs.docs[0].id,
        data: { active: true, answer: 'Initial release fixture answer', order: 9999 },
        context: { skipRevalidate: true },
      })
    : await payload.create({
        collection: 'faqs',
        overrideAccess: true,
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
