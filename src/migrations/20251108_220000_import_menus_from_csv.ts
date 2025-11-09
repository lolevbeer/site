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

interface DraftCSVRow {
  tap?: string
  variant: string
  salePrice: string
  name: string
  type: string
  abv: string
  glass: string
  draftPrice: string
  fourPack: string
  cansAvailable: string
  hops: string
}

interface CanCSVRow {
  variant: string
  cansAvailable: string
  name: string
  singleCanAvailable: string
  type: string
  abv: string
  canSingle: string
  fourPack: string
}

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  console.log('Starting menu migration from CSV...')

  // Get all locations
  const locations = await payload.find({
    collection: 'locations',
    limit: 100,
  })

  const locationMap = new Map<string, string>()
  locations.docs.forEach((loc: any) => {
    locationMap.set(loc.slug, loc.id)
  })

  console.log(`Found ${locationMap.size} locations`)

  // Menu configurations
  const menuConfigs = [
    {
      file: 'lawrenceville-draft.csv',
      locationSlug: 'lawrenceville',
      type: 'draft' as const,
      name: 'Lawrenceville Draft Menu',
      description: 'Current draft beer offerings at our Lawrenceville location',
    },
    {
      file: 'zelienople-draft.csv',
      locationSlug: 'zelienople',
      type: 'draft' as const,
      name: 'Zelienople Draft Menu',
      description: 'Current draft beer offerings at our Zelienople location',
    },
    {
      file: 'lawrenceville-cans.csv',
      locationSlug: 'lawrenceville',
      type: 'cans' as const,
      name: 'Lawrenceville Cans Menu',
      description: 'Canned beer available for purchase at our Lawrenceville location',
    },
    {
      file: 'zelienople-cans.csv',
      locationSlug: 'zelienople',
      type: 'cans' as const,
      name: 'Zelienople Cans Menu',
      description: 'Canned beer available for purchase at our Zelienople location',
    },
  ]

  let successCount = 0

  for (const config of menuConfigs) {
    try {
      console.log(`\nProcessing: ${config.name}`)

      const locationId = locationMap.get(config.locationSlug)
      if (!locationId) {
        console.error(`  ❌ Location not found: ${config.locationSlug}`)
        continue
      }

      // Check if menu already exists
      const existing = await payload.find({
        collection: 'menus',
        where: {
          and: [
            { location: { equals: locationId } },
            { type: { equals: config.type } },
          ],
        },
        limit: 1,
      })

      // Read CSV
      const csvPath = path.join(__dirname, `../../public/data/${config.file}`)
      if (!fs.existsSync(csvPath)) {
        console.error(`  ❌ CSV file not found: ${config.file}`)
        continue
      }

      const csvContent = fs.readFileSync(csvPath, 'utf-8')
      const result = Papa.parse<DraftCSVRow | CanCSVRow>(csvContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
      })

      console.log(`  Found ${result.data.length} beers in CSV`)

      // Build menu items
      const items: Array<{ beer: string; price?: string }> = []

      for (const row of result.data) {
        if (!row.variant) continue

        // Find beer by slug
        const beer = await payload.find({
          collection: 'beers',
          where: {
            slug: { equals: row.variant },
          },
          limit: 1,
        })

        if (beer.docs.length === 0) {
          console.log(`  ⚠️  Beer not found: ${row.variant}`)
          continue
        }

        const menuItem: { beer: string; price?: string } = {
          beer: beer.docs[0].id,
        }

        // Add sale price if applicable (only for draft menus)
        if (config.type === 'draft') {
          const draftRow = row as DraftCSVRow
          if (draftRow.salePrice === 'TRUE' && draftRow.fourPack) {
            menuItem.price = draftRow.fourPack
          }
        }

        items.push(menuItem)
      }

      if (items.length === 0) {
        console.log(`  ⚠️  No valid items found, skipping menu`)
        continue
      }

      // Create or update menu
      if (existing.docs.length > 0) {
        await payload.update({
          collection: 'menus',
          id: existing.docs[0].id,
          data: {
            items,
          },
        })
        console.log(`  ✓ Updated menu with ${items.length} items`)
      } else {
        await payload.create({
          collection: 'menus',
          data: {
            name: config.name,
            description: config.description,
            location: locationId,
            type: config.type,
            url: `${config.locationSlug}-${config.type}`,
            items,
            _status: 'published',
          },
        })
        console.log(`  ✓ Created menu with ${items.length} items`)
      }
      successCount++
    } catch (error) {
      console.error(`  ❌ Error:`, error)
    }
  }

  console.log(`\n=== Migration Complete ===`)
  console.log(`✓ Imported ${successCount} menus`)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  console.log('Rolling back menu migration...')

  // Get all locations
  const locations = await payload.find({
    collection: 'locations',
    limit: 100,
  })

  const locationMap = new Map<string, string>()
  locations.docs.forEach((loc: any) => {
    locationMap.set(loc.slug, loc.id)
  })

  const menuTypes = ['draft', 'cans']
  const locationSlugs = ['lawrenceville', 'zelienople']

  for (const locationSlug of locationSlugs) {
    for (const menuType of menuTypes) {
      const locationId = locationMap.get(locationSlug)
      if (!locationId) continue

      try {
        const existing = await payload.find({
          collection: 'menus',
          where: {
            and: [
              { location: { equals: locationId } },
              { type: { equals: menuType } },
            ],
          },
        })

        for (const doc of existing.docs) {
          await payload.delete({
            collection: 'menus',
            id: doc.id,
          })
          console.log(`Deleted: ${locationSlug} ${menuType} menu`)
        }
      } catch (error) {
        console.error(`Error deleting ${locationSlug} ${menuType} menu:`, error)
      }
    }
  }

  console.log('Rollback complete')
}
