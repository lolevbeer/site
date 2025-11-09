import {
  MigrateDownArgs,
  MigrateUpArgs,
} from '@payloadcms/db-mongodb'

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  console.log('Fixing draftPrice field to be a number...')

  // Get all beers
  const beers = await payload.find({
    collection: 'beers',
    limit: 1000,
  })

  console.log(`Found ${beers.docs.length} beers to update`)

  let updateCount = 0

  for (const beer of beers.docs) {
    try {
      // If draftPrice is a string, convert to number
      if (typeof beer.draftPrice === 'string') {
        const numValue = parseFloat(beer.draftPrice.replace('$', ''))

        await payload.update({
          collection: 'beers',
          id: beer.id,
          data: {
            draftPrice: isNaN(numValue) ? undefined : numValue,
          },
        })

        console.log(`  ✓ Updated ${beer.name}: "${beer.draftPrice}" -> ${numValue}`)
        updateCount++
      }
    } catch (error) {
      console.error(`  ❌ Error updating ${beer.name}:`, error)
    }
  }

  console.log(`\n✓ Updated ${updateCount} beers`)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  console.log('No rollback needed for draftPrice fix')
}
