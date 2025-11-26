/**
 * Clear broken image references from beers
 * This removes image field values that point to non-existent media documents
 *
 * Run with: npx tsx scripts/clear-broken-image-refs.ts
 */

import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'

async function clearBrokenImageRefs() {
  console.log('🔄 Clearing broken image references from beers...\n')

  try {
    const payload = await getPayload({ config })

    // Get all beers
    const beersResult = await payload.find({
      collection: 'beers',
      limit: 1000,
      depth: 0, // Don't populate relationships
    })

    console.log(`📦 Found ${beersResult.docs.length} beers to check\n`)

    let cleared = 0
    let skipped = 0

    for (const beer of beersResult.docs) {
      try {
        // If beer has an image field that's a string (ID reference)
        if (beer.image && typeof beer.image === 'string') {
          console.log(`Checking ${beer.name} (image: ${beer.image})...`)

          // Try to fetch the media document
          try {
            await payload.findByID({
              collection: 'media',
              id: beer.image,
            })
            console.log(`  ✅ Image reference is valid`)
            skipped++
          } catch (error) {
            // Media doesn't exist - clear the reference
            console.log(`  ❌ Broken reference - clearing...`)

            await payload.update({
              collection: 'beers',
              id: beer.id,
              data: {
                image: null,
              },
            })

            cleared++
            console.log(`  ✅ Cleared broken image reference for ${beer.name}`)
          }
        } else if (!beer.image) {
          console.log(`Skipping ${beer.name} (no image)`)
          skipped++
        } else {
          console.log(`Skipping ${beer.name} (image already populated)`)
          skipped++
        }
      } catch (error) {
        console.error(`❌ Error processing ${beer.name}:`, error)
      }
    }

    console.log('\n✨ Cleanup complete!')
    console.log(`✅ Cleared broken references: ${cleared}`)
    console.log(`⏭️  Skipped (valid or no image): ${skipped}`)

    process.exit(0)
  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  }
}

clearBrokenImageRefs()
