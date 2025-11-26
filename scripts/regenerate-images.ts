/**
 * Regenerate image sizes for all existing media in Payload
 * Run with: npx tsx scripts/regenerate-images.ts
 */

import { getPayload } from 'payload'
import config from '../src/payload.config'

async function regenerateImages() {
  console.log('🔄 Starting image regeneration...')

  try {
    const payload = await getPayload({ config })

    // Get all media documents
    const result = await payload.find({
      collection: 'media',
      limit: 1000,
    })

    console.log(`📸 Found ${result.docs.length} images to process`)

    let processed = 0
    let errors = 0

    for (const media of result.docs) {
      try {
        console.log(`Processing: ${media.filename || media.id}`)

        // Update the media document to trigger image size regeneration
        await payload.update({
          collection: 'media',
          id: media.id,
          data: {
            // Just update with existing data to trigger hooks
            alt: media.alt || '',
          },
        })

        processed++
        console.log(`✅ Processed ${processed}/${result.docs.length}`)
      } catch (error) {
        errors++
        console.error(`❌ Error processing ${media.filename || media.id}:`, error)
      }
    }

    console.log('\n✨ Image regeneration complete!')
    console.log(`✅ Successfully processed: ${processed}`)
    console.log(`❌ Errors: ${errors}`)

    process.exit(0)
  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  }
}

regenerateImages()
