/**
 * Regenerate all Payload media with new image sizes
 * This reads the original file and re-processes it through Payload's upload handler
 *
 * Run with: npx tsx scripts/regenerate-payload-images.ts
 */

import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import fs from 'fs'
import path from 'path'

async function regenerateAllImages() {
  console.log('🔄 Starting Payload image regeneration with new sizes...')
  console.log('📐 New sizes: thumbnail (150px), card (500px), detail (1200px)\n')

  try {
    const payload = await getPayload({ config })

    // Get all media documents
    const result = await payload.find({
      collection: 'media',
      limit: 1000,
    })

    console.log(`📸 Found ${result.docs.length} images\n`)

    let processed = 0
    let errors = 0
    let skipped = 0

    for (const media of result.docs) {
      try {
        const filename = media.filename
        const filePath = path.join(process.cwd(), 'public/uploads', filename!)

        // Check if original file exists
        if (!fs.existsSync(filePath)) {
          console.log(`⏭️  Skipping ${filename} (original file not found)`)
          skipped++
          continue
        }

        console.log(`Processing: ${filename}`)

        // Read the file
        const fileBuffer = fs.readFileSync(filePath)

        // Create a proper file object for Payload
        const fileData = {
          data: fileBuffer,
          name: filename!,
          size: fileBuffer.length,
          type: media.mimeType || 'image/png',
        }

        // Delete the old media entry (this removes all generated sizes)
        await payload.delete({
          collection: 'media',
          id: media.id,
        })

        // Re-upload to trigger size generation with new config
        await payload.create({
          collection: 'media',
          data: {
            alt: media.alt || filename,
          },
          file: fileData as any,
        })

        processed++
        console.log(`✅ ${processed}/${result.docs.length} - Regenerated ${filename}\n`)

      } catch (error) {
        errors++
        console.error(`❌ Error processing ${media.filename}:`, error)
      }
    }

    console.log('\n✨ Image regeneration complete!')
    console.log(`✅ Successfully processed: ${processed}`)
    console.log(`⏭️  Skipped: ${skipped}`)
    console.log(`❌ Errors: ${errors}`)

    process.exit(0)
  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  }
}

regenerateAllImages()
