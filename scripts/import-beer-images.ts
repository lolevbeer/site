/**
 * Import beer images from public/images/beer into Payload CMS
 * Links each image to the corresponding beer by slug
 *
 * Run with: npx tsx scripts/import-beer-images.ts
 */

import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import fs from 'fs'
import path from 'path'

async function importBeerImages() {
  console.log('🍺 Starting beer image import...\n')

  try {
    const payload = await getPayload({ config })

    // Get all beers
    const beersResult = await payload.find({
      collection: 'beers',
      limit: 1000,
    })

    console.log(`Found ${beersResult.docs.length} beers\n`)

    const imagesDir = path.join(process.cwd(), 'public/images/beer')
    let imported = 0
    let skipped = 0
    let errors = 0

    for (const beer of beersResult.docs) {
      try {
        const slug = beer.slug
        if (!slug) {
          console.log(`⏭️  Skipping beer without slug: ${beer.name}`)
          skipped++
          continue
        }

        // Look for {slug}.png
        const imagePath = path.join(imagesDir, `${slug}.png`)

        if (!fs.existsSync(imagePath)) {
          console.log(`⏭️  No image for ${slug}`)
          skipped++
          continue
        }

        console.log(`📸 Importing image for: ${beer.name} (${slug})`)

        // Read the file
        const fileBuffer = fs.readFileSync(imagePath)
        const fileData = {
          data: fileBuffer,
          name: `${slug}.png`,
          size: fileBuffer.length,
          mimetype: 'image/png',
        }

        // Create media entry
        const media = await payload.create({
          collection: 'media',
          data: {
            alt: `${beer.name} beer can`,
          },
          file: fileData as any,
        })

        // Update beer with image reference
        await payload.update({
          collection: 'beers',
          id: beer.id,
          data: {
            image: media.id,
          },
        })

        imported++
        console.log(`✅ ${imported} - Imported ${slug}\n`)

      } catch (error) {
        errors++
        console.error(`❌ Error importing ${beer.slug}:`, error)
      }
    }

    console.log('\n✨ Beer image import complete!')
    console.log(`✅ Imported: ${imported}`)
    console.log(`⏭️  Skipped: ${skipped}`)
    console.log(`❌ Errors: ${errors}`)

    process.exit(0)
  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  }
}

importBeerImages()
