/**
 * Test script to debug image upload for sync-google-sheets
 * Tests the exact same approach used in the endpoint
 *
 * Run with: npx tsx scripts/test-image-upload.ts
 */

import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import fs from 'fs'
import path from 'path'

async function testImageUpload() {
  console.log('🧪 Testing image upload workflow...\n')

  try {
    const payload = await getPayload({ config })

    // Use a test beer image (kamo since that's what failed)
    const variant = 'kamo'
    const imagePath = path.join(process.cwd(), 'public', 'images', 'beer', `${variant}.png`)

    // Check if image exists
    if (!fs.existsSync(imagePath)) {
      console.error(`❌ Image not found: ${imagePath}`)
      process.exit(1)
    }

    console.log(`📸 Found image: ${imagePath}`)
    console.log(`📊 File size: ${fs.statSync(imagePath).size} bytes\n`)

    // Delete any existing media for this variant
    console.log('🗑️  Checking for existing media...')
    const existingMedia = await payload.find({
      collection: 'media',
      where: {
        filename: { contains: variant },
      },
      limit: 10,
    })

    for (const media of existingMedia.docs) {
      console.log(`   Deleting old media: ${media.filename}`)
      await payload.delete({ collection: 'media', id: media.id })
    }

    // Read the file buffer
    console.log('\n📖 Reading file buffer...')
    const fileBuffer = fs.readFileSync(imagePath)
    const filename = path.basename(imagePath)
    console.log(`   Buffer size: ${fileBuffer.length} bytes`)
    console.log(`   Filename: ${filename}`)

    // Test Approach 1: file object (from working script)
    console.log('\n🧪 TEST 1: Using file object approach...')
    const fileData = {
      data: fileBuffer,
      name: filename,
      size: fileBuffer.length,
      mimetype: 'image/png',
    }

    try {
      const media1 = await payload.create({
        collection: 'media',
        data: {
          alt: `${variant} beer can - test 1`,
        },
        file: fileData as any,
      })

      console.log('✅ SUCCESS with file object!')
      console.log(`   Media ID: ${media1.id}`)
      console.log(`   Filename: ${media1.filename}`)
      console.log(`   URL: ${media1.url}`)

      // Clean up
      await payload.delete({ collection: 'media', id: media1.id })
      console.log('   Cleaned up test media')
    } catch (error: any) {
      console.error('❌ FAILED with file object')
      console.error(`   Error: ${error.message}`)
      if (error.data) {
        console.error(`   Validation errors:`, JSON.stringify(error.data, null, 2))
      }
    }

    // Test Approach 2: filePath (original approach)
    console.log('\n🧪 TEST 2: Using filePath approach...')
    try {
      const media2 = await payload.create({
        collection: 'media',
        data: {
          alt: `${variant} beer can - test 2`,
        },
        filePath: imagePath,
      })

      console.log('✅ SUCCESS with filePath!')
      console.log(`   Media ID: ${media2.id}`)
      console.log(`   Filename: ${media2.filename}`)
      console.log(`   URL: ${media2.url}`)

      // Clean up
      await payload.delete({ collection: 'media', id: media2.id })
      console.log('   Cleaned up test media')
    } catch (error: any) {
      console.error('❌ FAILED with filePath')
      console.error(`   Error: ${error.message}`)
      if (error.data) {
        console.error(`   Validation errors:`, JSON.stringify(error.data, null, 2))
      }
    }

    console.log('\n✨ Test complete!')
    process.exit(0)
  } catch (error: any) {
    console.error('❌ Fatal error:', error)
    console.error(error.stack)
    process.exit(1)
  }
}

testImageUpload()
