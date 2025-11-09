import {
  MigrateDownArgs,
  MigrateUpArgs,
} from '@payloadcms/db-mongodb'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Papa from 'papaparse'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface BeerCSVRow {
  variant: string
  name: string
  type: string
  options: string
  abv: string
  glass: string
  draftPrice: string
  canSingle: string
  fourPack: string
  description: string
  upc: string
  glutenFree: string
  image: string
  hideFromSite: string
  untappd: string
  recipe: string
  hops: string
}

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  console.log('Starting beer migration from CSV...')

  // Read CSV
  const csvPath = path.join(__dirname, '../../public/data/beer.csv')
  const csvContent = fs.readFileSync(csvPath, 'utf-8')
  const result = Papa.parse<BeerCSVRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim()
  })
  const beers = result.data

  console.log(`Found ${beers.length} beers in CSV`)

  // Get or create styles
  const styleMap = new Map<string, string>()

  for (const beer of beers) {
    if (!beer.type || styleMap.has(beer.type)) continue

    const existing = await payload.find({
      collection: 'styles',
      where: {
        name: { equals: beer.type }
      },
      limit: 1
    })

    if (existing.docs.length > 0) {
      styleMap.set(beer.type, existing.docs[0].id)
      console.log(`✓ Found style: ${beer.type}`)
    } else {
      const newStyle = await payload.create({
        collection: 'styles',
        data: {
          name: beer.type
        }
      })
      styleMap.set(beer.type, newStyle.id)
      console.log(`✓ Created style: ${beer.type}`)
    }
  }

  // Migrate beers
  let successCount = 0

  for (const beer of beers) {
    try {
      console.log(`\nMigrating: ${beer.name} (${beer.variant})`)

      // Check if beer already exists
      const existing = await payload.find({
        collection: 'beers',
        where: {
          slug: { equals: beer.variant }
        },
        limit: 1
      })

      if (existing.docs.length > 0) {
        console.log(`  ⚠️  Already exists, skipping`)
        continue
      }

      // Upload image if exists
      let mediaId: string | undefined
      const imagePath = path.join(__dirname, `../../public/images/beer/${beer.variant}.png`)

      if (fs.existsSync(imagePath)) {
        console.log(`  📸 Uploading image...`)
        const imageBuffer = fs.readFileSync(imagePath)

        const media = await payload.create({
          collection: 'media',
          data: {
            alt: beer.name
          },
          file: {
            data: imageBuffer,
            mimetype: 'image/png',
            name: `${beer.variant}.png`,
            size: imageBuffer.length
          }
        })

        mediaId = media.id
        console.log(`  ✓ Image uploaded`)
      }

      // Parse fourPack to number
      const fourPackNum = beer.fourPack ? parseFloat(beer.fourPack.replace('$', '')) : undefined

      // Parse draftPrice to number
      const draftPriceNum = beer.draftPrice ? parseFloat(beer.draftPrice.replace('$', '')) : undefined

      // Create beer
      await payload.create({
        collection: 'beers',
        data: {
          name: beer.name,
          slug: beer.variant,
          style: styleMap.get(beer.type),
          abv: parseFloat(beer.abv) || 0,
          glass: beer.glass || 'pint',
          draftPrice: draftPriceNum,
          fourPack: fourPackNum,
          canSingle: beer.canSingle || undefined,
          description: beer.description || undefined,
          upc: beer.upc || undefined,
          hops: beer.hops || undefined,
          untappd: beer.untappd || undefined,
          recipe: beer.recipe ? parseInt(beer.recipe) : undefined,
          hideFromSite: beer.hideFromSite === 'TRUE',
          image: mediaId
        }
      })

      console.log(`  ✓ Created`)
      successCount++

    } catch (error) {
      console.error(`  ❌ Error:`, error)
    }
  }

  console.log(`\n=== Migration Complete ===`)
  console.log(`✓ Imported ${successCount} beers`)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  console.log('Rolling back beer migration...')

  // Read CSV to get list of beer slugs to remove
  const csvPath = path.join(__dirname, '../../public/data/beer.csv')
  const csvContent = fs.readFileSync(csvPath, 'utf-8')
  const result = Papa.parse<BeerCSVRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
  })

  // Delete beers by slug
  for (const beer of result.data) {
    try {
      const existing = await payload.find({
        collection: 'beers',
        where: {
          slug: { equals: beer.variant }
        }
      })

      for (const doc of existing.docs) {
        await payload.delete({
          collection: 'beers',
          id: doc.id
        })
        console.log(`Deleted: ${beer.name}`)
      }
    } catch (error) {
      console.error(`Error deleting ${beer.name}:`, error)
    }
  }

  console.log('Rollback complete')
}
