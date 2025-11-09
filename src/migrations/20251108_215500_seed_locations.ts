import {
  MigrateDownArgs,
  MigrateUpArgs,
} from '@payloadcms/db-mongodb'

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  console.log('Seeding locations...')

  const locations = [
    {
      name: 'Lawrenceville',
      slug: 'lawrenceville',
      active: true,
      basicInfo: {
        phone: '412-586-4677',
        email: 'lawrenceville@lolevbeer.com',
      },
      address: {
        street: '3721 Butler Street',
        city: 'Pittsburgh',
        state: 'PA',
        zip: '15201',
      },
    },
    {
      name: 'Zelienople',
      slug: 'zelienople',
      active: true,
      basicInfo: {
        phone: '724-452-6768',
        email: 'zelienople@lolevbeer.com',
      },
      address: {
        street: '111 S Main Street',
        city: 'Zelienople',
        state: 'PA',
        zip: '16063',
      },
    },
  ]

  let successCount = 0

  for (const location of locations) {
    try {
      console.log(`\nChecking: ${location.name}`)

      // Check if location already exists
      const existing = await payload.find({
        collection: 'locations',
        where: {
          slug: { equals: location.slug },
        },
        limit: 1,
      })

      if (existing.docs.length > 0) {
        console.log(`  ⚠️  Already exists, skipping`)
        continue
      }

      // Create location
      await payload.create({
        collection: 'locations',
        data: location,
      })

      console.log(`  ✓ Created`)
      successCount++
    } catch (error) {
      console.error(`  ❌ Error:`, error)
    }
  }

  console.log(`\n=== Seeding Complete ===`)
  console.log(`✓ Created ${successCount} locations`)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  console.log('Removing seeded locations...')

  const locationSlugs = ['lawrenceville', 'zelienople']

  for (const slug of locationSlugs) {
    try {
      const existing = await payload.find({
        collection: 'locations',
        where: {
          slug: { equals: slug },
        },
      })

      for (const doc of existing.docs) {
        await payload.delete({
          collection: 'locations',
          id: doc.id,
        })
        console.log(`Deleted: ${slug}`)
      }
    } catch (error) {
      console.error(`Error deleting ${slug}:`, error)
    }
  }

  console.log('Rollback complete')
}
