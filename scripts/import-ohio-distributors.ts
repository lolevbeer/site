/**
 * Import distributors from Sixth City/Encompass8 JSON API
 *
 * Usage:
 *   pnpm tsx scripts/import-ohio-distributors.ts [--pa | --oh] [--dry-run]
 *
 * Options:
 *   --pa         Import Pennsylvania distributors
 *   --oh         Import Ohio distributors (default)
 *   --dry-run    Preview what would be imported without writing to database
 *
 * URLs are configured in Site Content > Distributor Import
 */

import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'

interface DistributorRow {
  CustomerName: string
  AddressCityStateZip: string
  CaseEquivSale: string
}

interface ParsedAddress {
  street: string
  city: string
  state: string
  zip: string
}

function parseAddress(combined: string, defaultState: string): ParsedAddress | null {
  // Be lenient with parsing - use defaultState for the region
  // Format: "112 W. 15th St., Cincinnati, OH 45202"
  // or: "14900 Detroit Rd, Lakewood, OH 44107"

  // Try standard format first
  const match = combined.match(/^(.+),\s*(.+),\s*([A-Za-z]{2,4})\s*(\d{4,6}(?:-\d{4})?)$/)
  if (match) {
    return {
      street: match[1].trim(),
      city: match[2].trim(),
      state: defaultState,
      zip: match[4].length === 5 ? match[4] : '', // Only use valid 5-digit zips
    }
  }

  // Try without proper zip
  const altMatch = combined.match(/^(.+),\s*(.+),\s*([A-Za-z]{2,4})\s*\d*$/)
  if (altMatch) {
    return {
      street: altMatch[1].trim(),
      city: altMatch[2].trim(),
      state: defaultState,
      zip: '',
    }
  }

  // Last resort: split by commas and hope for the best
  const parts = combined.split(',').map(p => p.trim())
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1]
    const zipMatch = lastPart.match(/(\d{5})/)
    const cityPart = parts.length >= 3 ? parts[parts.length - 2] : parts[parts.length - 1].replace(/[A-Z]{2}\s*\d+/, '').trim()

    return {
      street: parts.slice(0, -1).join(', ').replace(/,\s*$/, ''),
      city: cityPart.replace(/[A-Za-z]{2,4}\s*\d*$/, '').trim() || defaultState,
      state: defaultState,
      zip: zipMatch ? zipMatch[1] : '',
    }
  }

  return null
}

// Default coordinates for each region
const DEFAULT_COORDS: Record<string, [number, number]> = {
  PA: [-79.9959, 40.4406], // Pittsburgh
  OH: [-82.9988, 39.9612], // Columbus
}

async function geocodeAddress(address: string): Promise<[number, number] | null> {
  // Using OpenStreetMap Nominatim (free, no API key needed)
  // Rate limit: 1 request per second
  const encoded = encodeURIComponent(address)
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=1`

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'LolevBeer-Import/1.0',
      },
    })

    if (!response.ok) {
      console.error(`  Geocode HTTP error: ${response.status}`)
      return null
    }

    const data = await response.json()
    if (data.length === 0) return null

    const lon = parseFloat(data[0].lon)
    const lat = parseFloat(data[0].lat)
    return [lon, lat]
  } catch (error: any) {
    console.error(`  Geocode error: ${error.message}`)
    return null
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
}

async function fetchDistributors(url: string): Promise<DistributorRow[]> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const data = await response.json()
    // The data is in Export.Table.Row format
    const rows = data?.Export?.Table?.Row || []
    // Decode HTML entities in customer names and filter out system rows
    return rows
      .map((row: DistributorRow) => ({
        ...row,
        CustomerName: decodeHtmlEntities(row.CustomerName),
      }))
      .filter((row: DistributorRow) =>
        !row.CustomerName.toLowerCase().includes('fifo') &&
        !row.CustomerName.toLowerCase().includes('adjustment') &&
        !row.AddressCityStateZip.toLowerCase().includes('distributor address')
      )
  } catch (error: any) {
    console.error(`Error fetching data: ${error.message}`)
    return []
  }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const importPA = args.includes('--pa')
  const region = importPA ? 'PA' : 'OH'
  const regionName = importPA ? 'Pennsylvania' : 'Ohio'

  console.log('='.repeat(50))
  console.log(`${regionName} Distributors Import (Sixth City/Encompass8)`)
  console.log('='.repeat(50))

  if (dryRun) {
    console.log('\n[DRY RUN MODE - No data will be written]\n')
  }

  // Get URL from SiteContent
  const payload = await getPayload({ config })
  console.log('Connected to Payload CMS')

  const siteContent = await payload.findGlobal({ slug: 'site-content' })
  const jsonUrl = importPA
    ? (siteContent as any).distributorPaUrl
    : (siteContent as any).distributorOhUrl

  if (!jsonUrl) {
    console.error(`\nNo URL configured for ${regionName} distributors.`)
    console.error(`Set it in: Admin > Sync > Distributor Location Data`)
    process.exit(1)
  }

  console.log(`Using URL: ${jsonUrl.substring(0, 60)}...`)

  const rows = await fetchDistributors(jsonUrl)
  console.log(`Fetched ${rows.length} distributor records`)

  if (rows.length === 0) {
    console.log('No data to import')
    process.exit(0)
  }

  if (dryRun) {
    console.log('\nSample data:')
    rows.slice(0, 5).forEach((r) => {
      const parsed = parseAddress(r.AddressCityStateZip, region)
      console.log(`  - ${r.CustomerName}`)
      console.log(`    Address: ${r.AddressCityStateZip}`)
      if (parsed) {
        console.log(`    Parsed: ${parsed.street}, ${parsed.city}, ${parsed.state} ${parsed.zip}`)
      } else {
        console.log(`    [Could not parse address]`)
      }
    })
    if (rows.length > 5) console.log(`  ... and ${rows.length - 5} more`)
    process.exit(0)
  }

  try {
    let imported = 0,
      skipped = 0,
      errors = 0

    for (const row of rows) {
      const parsed = parseAddress(row.AddressCityStateZip, region)
      if (!parsed) {
        console.log(`  Skipping "${row.CustomerName}" - could not parse address: ${row.AddressCityStateZip}`)
        errors++
        continue
      }

      // Check for existing distributor by name
      const existing = await payload.find({
        collection: 'distributors',
        where: {
          name: { equals: row.CustomerName },
        },
        limit: 1,
      })

      if (existing.docs.length > 0) {
        console.log(`  Skipping "${row.CustomerName}" - already exists`)
        skipped++
        continue
      }

      // Geocode the address
      const fullAddress = `${parsed.street}, ${parsed.city}, ${parsed.state} ${parsed.zip}`
      console.log(`  Geocoding "${row.CustomerName}"...`)
      const coords = await geocodeAddress(fullAddress)

      if (!coords) {
        console.log(`    [Warning] Could not geocode - using default coordinates`)
      }

      // Use region-specific default coordinates if geocoding fails
      const location: [number, number] = coords || DEFAULT_COORDS[region]

      try {
        await payload.create({
          collection: 'distributors',
          data: {
            name: row.CustomerName,
            address: parsed.street,
            city: parsed.city,
            state: parsed.state,
            zip: parsed.zip,
            customerType: 'Retail',
            region: region,
            location,
            active: true,
          },
        })
        console.log(`    Imported: ${row.CustomerName}`)
        imported++
      } catch (error: any) {
        console.error(`    Error: ${error.message}`)
        errors++
      }

      // Rate limit for Nominatim API (1 req/sec)
      await sleep(1100)
    }

    console.log('\n' + '='.repeat(50))
    console.log('Import Summary')
    console.log('='.repeat(50))
    console.log(`Imported: ${imported}`)
    console.log(`Skipped (existing): ${skipped}`)
    console.log(`Errors: ${errors}`)
  } catch (error: any) {
    console.error('\nFatal error:', error.message)
    process.exit(1)
  }

  process.exit(0)
}

main()
