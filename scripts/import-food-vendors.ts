import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'
import { parse } from 'csv-parse/sync'
import fs from 'fs'
import path from 'path'

async function importFoodVendors() {
  const csvPath = process.argv[2]

  if (!csvPath) {
    console.error('Usage: npx tsx scripts/import-food-vendors.ts <path-to-csv>')
    process.exit(1)
  }

  const absolutePath = path.resolve(csvPath)

  if (!fs.existsSync(absolutePath)) {
    console.error(`File not found: ${absolutePath}`)
    process.exit(1)
  }

  const payload = await getPayload({ config })

  const csvContent = fs.readFileSync(absolutePath, 'utf-8')
  interface CsvRecord {
    vendor?: string
    contact?: string
    phone?: string
    social?: string
  }

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRecord[]

  console.log(`Found ${records.length} vendors to import`)

  let created = 0
  let skipped = 0
  let errors = 0

  for (const record of records) {
    const vendorName = record.vendor?.trim()

    if (!vendorName) {
      console.log('Skipping row with no vendor name')
      skipped++
      continue
    }

    // Check if vendor already exists
    const existing = await payload.find({
      collection: 'food-vendors',
      where: { name: { equals: vendorName } },
      limit: 1,
    })

    if (existing.docs.length > 0) {
      console.log(`Skipping existing vendor: ${vendorName}`)
      skipped++
      continue
    }

    try {
      await payload.create({
        collection: 'food-vendors',
        data: {
          name: vendorName,
          email: record.contact?.trim() || undefined,
          phone: record.phone?.trim() || undefined,
          site: record.social?.trim() || undefined,
        },
      })
      console.log(`Created: ${vendorName}`)
      created++
    } catch (err) {
      console.error(`Error creating ${vendorName}:`, err)
      errors++
    }
  }

  console.log(`\nImport complete:`)
  console.log(`  Created: ${created}`)
  console.log(`  Skipped: ${skipped}`)
  console.log(`  Errors: ${errors}`)

  process.exit(0)
}

importFoodVendors()
