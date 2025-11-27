/**
 * Payload endpoint to sync from Google Sheets (SSE streaming)
 * Supports: Events, Food, Beers, Menus (Cans/Draft)
 */

import type { PayloadHandler } from 'payload'
import { diffJson } from 'diff'
import path from 'path'
import fs from 'fs/promises'
import fsSync from 'fs'
import { slugify } from '../collections/utils/generateUniqueSlug'

interface StreamController {
  send: (event: string, data: any) => void;
}

interface FieldChange {
  field: string
  from: any
  to: any
}

function computeChanges(existing: Record<string, any>, incoming: Record<string, any>, fields: string[]): FieldChange[] {
  const changes: FieldChange[] = []
  for (const field of fields) {
    const from = normalize(existing[field])
    const to = normalize(incoming[field])
    if (from !== to) {
      changes.push({ field, from, to })
    }
  }
  return changes
}

type CollectionType = 'events' | 'food' | 'beers' | 'menus'

const SHEETS_CONFIG = {
  events: {
    lawrenceville: process.env.GOOGLE_CSV_EVENTS_LAWRENCEVILLE || '',
    zelienople: process.env.GOOGLE_CSV_EVENTS_ZELIENOPLE || '',
  },
  food: {
    lawrenceville: process.env.GOOGLE_CSV_FOOD_LAWRENCEVILLE || '',
    zelienople: process.env.GOOGLE_CSV_FOOD_ZELIENOPLE || '',
  },
  beers: process.env.GOOGLE_CSV_BEER || '',
  menus: {
    cans: {
      lawrenceville: process.env.GOOGLE_CSV_LAWRENCEVILLE_CANS || '',
      zelienople: process.env.GOOGLE_CSV_ZELIENOPLE_CANS || '',
    },
    draft: {
      lawrenceville: process.env.GOOGLE_CSV_LAWRENCEVILLE_DRAFT || '',
      zelienople: process.env.GOOGLE_CSV_ZELIENOPLE_DRAFT || '',
    },
  },
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  const headers = parseCSVLine(lines[0])

  return lines.slice(1).map(line => {
    const values = parseCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((header, i) => {
      row[header.toLowerCase().trim()] = values[i]?.trim() || ''
    })
    return row
  })
}

async function fetchCSV(url: string): Promise<Record<string, string>[]> {
  if (!url) return []

  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  const text = await response.text()
  return parseCSV(text)
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return new Date(`${dateStr}T12:00:00`)
  }
  const date = new Date(dateStr)
  return isNaN(date.getTime()) ? null : date
}

function normalize(val: any): any {
  if (val === '' || val === undefined || val === null) return null
  return val
}

function parsePrice(price: string): number | undefined {
  if (!price) return undefined
  const num = parseFloat(price.replace(/[$,]/g, ''))
  return isNaN(num) ? undefined : num
}

// ============ IMAGE UTILITIES ============
async function findBeerImage(variant: string): Promise<string | null> {
  const imageDir = path.join(process.cwd(), 'public', 'images', 'beer')
  // Only use PNG source files - Payload will convert to webp with all sizes
  const imagePath = path.join(imageDir, `${variant}.png`)
  try {
    await fs.access(imagePath)
    return imagePath
  } catch {
    return null
  }
}

async function uploadBeerImage(
  payload: any,
  variant: string,
  imagePath: string,
  stream: StreamController
): Promise<string | null> {
  try {
    // Delete any existing media for this variant (force re-upload from PNG)
    const existingMedia = await payload.find({
      collection: 'media',
      where: {
        filename: { contains: variant },
      },
      limit: 10,
    })

    for (const media of existingMedia.docs) {
      await payload.delete({ collection: 'media', id: media.id })
      stream.send('status', { message: `Deleted old media for ${variant}` })
    }

    // Also delete any existing files on disk for this variant
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    try {
      const files = await fs.readdir(uploadsDir)
      for (const file of files) {
        if (file.startsWith(variant + '.') || file.startsWith(variant + '-')) {
          await fs.unlink(path.join(uploadsDir, file))
          stream.send('status', { message: `Deleted file ${file}` })
        }
      }
    } catch {
      // Ignore errors reading/deleting files
    }

    // Read the file buffer
    stream.send('status', { message: `Reading image file for ${variant}...` })
    const fileBuffer = fsSync.readFileSync(imagePath)
    const filename = path.basename(imagePath)

    stream.send('status', { message: `Image loaded: ${fileBuffer.length} bytes, filename: ${filename}` })

    // Try using the uploadFile API if available on payload.local
    stream.send('status', { message: `Creating media entry for ${variant}...` })

    // Payload 3.x local API - try the working approach from the script
    const fileData = {
      data: fileBuffer,
      name: filename,
      size: fileBuffer.length,
      mimetype: 'image/png',
    }

    try {
      const media = await payload.create({
        collection: 'media',
        data: {
          alt: `${variant} beer can`,
        },
        file: fileData as any,
      })

      stream.send('status', { message: `✅ Uploaded image for ${variant}` })
      return media.id
    } catch (fileError: any) {
      // If file approach fails, try filePath as fallback
      stream.send('status', { message: `File object failed, trying filePath: ${fileError.message}` })

      const media = await payload.create({
        collection: 'media',
        data: {
          alt: `${variant} beer can`,
        },
        filePath: imagePath,
      })

      stream.send('status', { message: `✅ Uploaded image for ${variant} via filePath` })
      return media.id
    }
  } catch (error: any) {
    const errorMsg = error?.stack || error?.message || String(error)
    stream.send('error', { message: `❌ Failed to upload image for ${variant}: ${errorMsg}` })
    return null
  }
}

// ============ SYNC EVENTS ============
async function syncEvents(payload: any, stream: StreamController, dryRun: boolean, locationMap: Map<string, string>) {
  const results = { imported: 0, updated: 0, skipped: 0, errors: 0 }

  for (const [locationSlug, url] of Object.entries(SHEETS_CONFIG.events)) {
    if (!url) continue

    const locationId = locationMap.get(locationSlug)
    if (!locationId) {
      stream.send('error', { message: `Location "${locationSlug}" not found` })
      continue
    }

    stream.send('status', { message: `Fetching ${locationSlug} events...` })

    try {
      const rows = await fetchCSV(url)
      const events = rows.filter(r => r.date && r.vendor)

      stream.send('status', { message: `Processing ${events.length} ${locationSlug} events...` })

      for (const event of events) {
        const date = parseDate(event.date)
        if (!date) {
          results.skipped++
          continue
        }

        const existing = await payload.find({
          collection: 'events',
          where: {
            and: [
              { vendor: { equals: event.vendor } },
              { date: { equals: date.toISOString() } },
              { location: { equals: locationId } },
            ],
          },
          limit: 1,
        })

        const eventData = {
          vendor: event.vendor,
          date: date.toISOString(),
          time: event.time || undefined,
          endTime: event.end || undefined,
          location: locationId,
          visibility: 'public',
          site: event.site || undefined,
          attendees: event.attendees ? parseInt(event.attendees) : undefined,
          source: 'google-sheets' as const,
        }

        if (existing.docs.length > 0) {
          const existingDoc = existing.docs[0]
          const incomingForCompare = {
            time: event.time || null,
            endTime: event.end || null,
            site: event.site || null,
            attendees: event.attendees ? parseInt(event.attendees) : null,
          }
          const existingForCompare = {
            time: existingDoc.time,
            endTime: existingDoc.endTime,
            site: existingDoc.site,
            attendees: existingDoc.attendees,
          }
          const changes = computeChanges(existingForCompare, incomingForCompare, ['time', 'endTime', 'site', 'attendees'])

          if (changes.length === 0) {
            results.skipped++
            continue
          }

          if (!dryRun) {
            await payload.update({ collection: 'events', id: existingDoc.id, data: eventData })
          }
          results.updated++
          stream.send('event', {
            action: dryRun ? 'would update' : 'updated',
            vendor: event.vendor,
            date: event.date,
            location: locationSlug,
            changes,
          })
          continue
        }

        if (!dryRun) {
          await payload.create({ collection: 'events', data: eventData })
        }
        results.imported++
        stream.send('event', { action: dryRun ? 'would import' : 'imported', vendor: event.vendor, date: event.date, location: locationSlug })
      }
    } catch (error: any) {
      stream.send('error', { message: `Error syncing ${locationSlug} events: ${error.message}` })
      results.errors++
    }
  }

  return results
}

// ============ SYNC FOOD ============
async function syncFood(payload: any, stream: StreamController, dryRun: boolean, locationMap: Map<string, string>) {
  const results = { imported: 0, updated: 0, skipped: 0, errors: 0 }

  for (const [locationSlug, url] of Object.entries(SHEETS_CONFIG.food)) {
    if (!url) continue

    const locationId = locationMap.get(locationSlug)
    if (!locationId) {
      stream.send('error', { message: `Location "${locationSlug}" not found` })
      continue
    }

    stream.send('status', { message: `Fetching ${locationSlug} food...` })

    try {
      const rows = await fetchCSV(url)
      const foods = rows.filter(r => r.vendor && r.date)

      stream.send('status', { message: `Processing ${foods.length} ${locationSlug} food entries...` })

      for (const food of foods) {
        const date = parseDate(food.date)
        if (!date) {
          results.skipped++
          continue
        }

        const existing = await payload.find({
          collection: 'food',
          where: {
            and: [
              { vendor: { equals: food.vendor } },
              { date: { equals: date.toISOString() } },
              { location: { equals: locationId } },
            ],
          },
          limit: 1,
        })

        const foodData = {
          vendor: food.vendor,
          date: date.toISOString(),
          time: food.time || 'TBD',
          location: locationId,
          site: food.site || undefined,
          day: food.day || undefined,
          start: food.start || undefined,
          finish: food.finish || undefined,
          week: food.week ? parseInt(food.week) : undefined,
          dayNumber: food.daynumber ? parseInt(food.daynumber) : undefined,
          source: 'google-sheets' as const,
        }

        if (existing.docs.length > 0) {
          const existingDoc = existing.docs[0]
          const incomingForCompare = {
            time: food.time || 'TBD',
            site: food.site || null,
            day: food.day || null,
            start: food.start || null,
            finish: food.finish || null,
          }
          const existingForCompare = {
            time: existingDoc.time,
            site: existingDoc.site,
            day: existingDoc.day,
            start: existingDoc.start,
            finish: existingDoc.finish,
          }
          const changes = computeChanges(existingForCompare, incomingForCompare, ['time', 'site', 'day', 'start', 'finish'])

          if (changes.length === 0) {
            results.skipped++
            continue
          }

          if (!dryRun) {
            await payload.update({ collection: 'food', id: existingDoc.id, data: foodData })
          }
          results.updated++
          stream.send('food', {
            action: dryRun ? 'would update' : 'updated',
            vendor: food.vendor,
            date: food.date,
            location: locationSlug,
            changes,
          })
          continue
        }

        if (!dryRun) {
          await payload.create({ collection: 'food', data: foodData })
        }
        results.imported++
        stream.send('food', { action: dryRun ? 'would import' : 'imported', vendor: food.vendor, date: food.date, location: locationSlug })
      }
    } catch (error: any) {
      stream.send('error', { message: `Error syncing ${locationSlug} food: ${error.message}` })
      results.errors++
    }
  }

  return results
}

// ============ SYNC BEERS ============
async function syncBeers(payload: any, stream: StreamController, dryRun: boolean) {
  const results = { imported: 0, updated: 0, skipped: 0, errors: 0, imagesAdded: 0 }

  const url = SHEETS_CONFIG.beers
  if (!url) {
    stream.send('error', { message: 'Beer CSV URL not configured' })
    return results
  }

  stream.send('status', { message: 'Fetching beers...' })

  try {
    const rows = await fetchCSV(url)
    const beers = rows.filter(r => r.name && r.variant)

    // Get all styles for lookup
    const stylesResult = await payload.find({ collection: 'styles', limit: 200 })
    const styleMap = new Map<string, string>()
    for (const style of stylesResult.docs) {
      styleMap.set(style.name.toLowerCase(), style.id)
    }

    stream.send('status', { message: `Processing ${beers.length} beers...` })

    for (const beer of beers) {
      if (!beer.name || !beer.type) {
        results.skipped++
        continue
      }

      // Find or create style
      let styleId: string | undefined = styleMap.get(beer.type.toLowerCase())
      if (!styleId) {
        if (!dryRun) {
          const newStyle = await payload.create({ collection: 'styles', data: { name: beer.type } })
          styleId = newStyle.id
          styleMap.set(beer.type.toLowerCase(), styleId as string)
        } else {
          stream.send('status', { message: `Would create style: ${beer.type}` })
          styleId = 'dry-run-placeholder'
        }
      }

      // Use the sheet's variant as the slug (curated), or generate from name for new entries
      const sheetVariant = beer.variant?.toLowerCase().trim()
      const slug = sheetVariant || slugify(beer.name)

      // Skip beers that can't generate a valid slug
      if (!slug) {
        stream.send('error', { message: `Beer "${beer.name}" has no variant and cannot generate a valid slug, skipping` })
        results.skipped++
        continue
      }

      // Look up existing beer by slug or name
      let existing = await payload.find({
        collection: 'beers',
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 1,
      })

      // Try looking up by name to prevent duplicates
      if (existing.docs.length === 0) {
        existing = await payload.find({
          collection: 'beers',
          where: { name: { equals: beer.name } },
          limit: 1,
          depth: 1,
        })
      }

      // Validate glass type - only allow valid options, default to 'pint'
      const validGlasses = ['pint', 'stein', 'teku']
      const glass = validGlasses.includes(beer.glass?.toLowerCase()) ? beer.glass.toLowerCase() : 'pint'

      // Check for image file - use the original variant for image lookup
      let imageId: string | undefined = undefined
      const imagePath = await findBeerImage(beer.variant) || await findBeerImage(slug)

      if (imagePath) {
        // Check if existing beer already has an image
        const existingBeer = existing.docs[0]
        const hasExistingImage = existingBeer?.image &&
          (typeof existingBeer.image === 'object' ? existingBeer.image.id : existingBeer.image)

        if (!hasExistingImage && !dryRun) {
          // Upload the image
          imageId = await uploadBeerImage(payload, beer.variant, imagePath, stream) || undefined
          if (imageId) {
            results.imagesAdded++
          }
        } else if (!hasExistingImage && dryRun) {
          stream.send('status', { message: `Would upload image for ${beer.variant}` })
        }
      }

      const beerData: Record<string, any> = {
        name: beer.name,
        slug: slug,
        style: styleId as string,
        abv: beer.abv ? parseFloat(beer.abv) : undefined,
        glass,
        draftPrice: parsePrice(beer.draftprice),
        fourPack: parsePrice(beer.fourpack),
        description: beer.description || undefined,
        hops: beer.hops || undefined,
        upc: beer.upc || undefined,
        untappd: beer.untappd || undefined,
        hideFromSite: beer.hidefromsite === 'TRUE',
      }

      // Add image if we uploaded one
      if (imageId) {
        beerData.image = imageId
      }

      if (existing.docs.length > 0) {
        const existingDoc = existing.docs[0]
        const incomingForCompare = {
          name: beer.name,
          slug: slug,
          abv: beerData.abv ?? null,
          glass,
          draftPrice: beerData.draftPrice ?? null,
          fourPack: beerData.fourPack ?? null,
          description: beer.description || null,
          hops: beer.hops || null,
          hideFromSite: beerData.hideFromSite,
        }
        const existingForCompare = {
          name: existingDoc.name,
          slug: existingDoc.slug,
          abv: existingDoc.abv ?? null,
          glass: existingDoc.glass,
          draftPrice: existingDoc.draftPrice ?? null,
          fourPack: existingDoc.fourPack ?? null,
          description: existingDoc.description || null,
          hops: existingDoc.hops || null,
          hideFromSite: existingDoc.hideFromSite ?? false,
        }
        const changes = computeChanges(existingForCompare, incomingForCompare, ['name', 'slug', 'abv', 'glass', 'draftPrice', 'fourPack', 'description', 'hops', 'hideFromSite'])

        // Also check if we're adding an image
        const addingImage = imageId && !existingDoc.image

        if (changes.length === 0 && !addingImage) {
          results.skipped++
          continue
        }

        if (addingImage) {
          changes.push({ field: 'image', from: null, to: 'uploaded' })
        }

        if (!dryRun) {
          await payload.update({ collection: 'beers', id: existingDoc.id, data: beerData })
        }
        results.updated++
        stream.send('beer', {
          action: dryRun ? 'would update' : 'updated',
          name: beer.name,
          style: beer.type,
          changes,
        })
        continue
      }

      if (!dryRun) {
        await payload.create({ collection: 'beers', data: beerData })
      }
      results.imported++
      stream.send('beer', {
        action: dryRun ? 'would import' : 'imported',
        name: beer.name,
        style: beer.type,
        hasImage: !!imageId,
      })
    }
  } catch (error: any) {
    stream.send('error', { message: `Error syncing beers: ${error.message}` })
    results.errors++
  }

  return results
}

// ============ SYNC MENUS ============
async function syncMenus(payload: any, stream: StreamController, dryRun: boolean, locationMap: Map<string, string>) {
  const results = { imported: 0, updated: 0, skipped: 0, errors: 0 }

  // Get all beers for lookup
  const beersResult = await payload.find({ collection: 'beers', limit: 500 })
  const beerMap = new Map<string, string>()
  for (const beer of beersResult.docs) {
    beerMap.set(beer.slug.toLowerCase(), beer.id)
  }

  for (const menuType of ['cans', 'draft'] as const) {
    const menuConfig = SHEETS_CONFIG.menus[menuType]

    for (const [locationSlug, url] of Object.entries(menuConfig)) {
      if (!url) continue

      const locationId = locationMap.get(locationSlug)
      if (!locationId) {
        stream.send('error', { message: `Location "${locationSlug}" not found` })
        continue
      }

      stream.send('status', { message: `Fetching ${locationSlug} ${menuType} menu...` })

      try {
        const rows = await fetchCSV(url)
        // Filter out empty rows
        const items = rows.filter(r => r.variant && r.name)

        stream.send('status', { message: `Processing ${items.length} ${locationSlug} ${menuType} items...` })

        // Build menu items array
        const menuItems: { beer: string; price?: string }[] = []
        for (const item of items) {
          // Use variant directly as slug (matches beer import logic)
          const itemSlug = item.variant.toLowerCase().trim()
          const beerId = beerMap.get(itemSlug)
          if (!beerId) {
            stream.send('error', { message: `Beer "${item.variant}" not found for ${locationSlug} ${menuType}` })
            continue
          }

          const price = item.saleprice && item.saleprice !== 'FALSE' ? item.saleprice :
                       item.price ? item.price : undefined

          menuItems.push({ beer: beerId, price })
        }

        // Find existing menu
        const menuUrl = `${locationSlug}-${menuType}`
        const existing = await payload.find({
          collection: 'menus',
          where: { url: { equals: menuUrl } },
          limit: 1,
        })

        const menuData = {
          name: `${locationSlug.charAt(0).toUpperCase() + locationSlug.slice(1)} ${menuType.charAt(0).toUpperCase() + menuType.slice(1)} Menu`,
          description: `${menuType === 'cans' ? 'Cans' : 'Draft'} menu for ${locationSlug}`,
          location: locationId,
          type: menuType,
          url: menuUrl,
          items: menuItems,
          _status: 'published',
        }

        if (existing.docs.length > 0) {
          const existingDoc = existing.docs[0]
          // Check if items changed
          const existingItems = existingDoc.items || []
          const existingNormalized = existingItems.map((i: any) => ({
            beer: typeof i.beer === 'object' ? i.beer.id : i.beer,
            price: i.price || null
          }))
          const incomingNormalized = menuItems.map(i => ({
            beer: i.beer,
            price: i.price || null
          }))

          // Use diffJson to compute actual differences
          const diff = diffJson(existingNormalized, incomingNormalized)
          const hasChanges = diff.some(part => part.added || part.removed)

          if (!hasChanges) {
            results.skipped++
            continue
          }

          // Compute human-readable changes
          const added = incomingNormalized.filter(inc =>
            !existingNormalized.some((ex: any) => ex.beer === inc.beer)
          )
          const removed = existingNormalized.filter((ex: any) =>
            !incomingNormalized.some(inc => inc.beer === ex.beer)
          )
          const priceChanges = incomingNormalized.filter(inc => {
            const ex = existingNormalized.find((e: any) => e.beer === inc.beer)
            return ex && ex.price !== inc.price
          })

          if (!dryRun) {
            await payload.update({ collection: 'menus', id: existingDoc.id, data: menuData })
          }
          results.updated++
          stream.send('menu', {
            action: dryRun ? 'would update' : 'updated',
            location: locationSlug,
            type: menuType,
            itemCount: menuItems.length,
            changes: {
              added: added.length,
              removed: removed.length,
              priceChanges: priceChanges.length,
            },
          })
          continue
        }

        if (!dryRun) {
          await payload.create({ collection: 'menus', data: menuData })
        }
        results.imported++
        stream.send('menu', { action: dryRun ? 'would import' : 'imported', location: locationSlug, type: menuType, itemCount: menuItems.length })

      } catch (error: any) {
        stream.send('error', { message: `Error syncing ${locationSlug} ${menuType}: ${error.message}` })
        results.errors++
      }
    }
  }

  return results
}

// ============ LOCATION SEED DATA ============
const LOCATION_SEED_DATA = {
  lawrenceville: {
    name: 'Lawrenceville',
    active: true,
    timezone: 'America/New_York',
    basicInfo: {
      phone: '(412) 336-8965',
      email: 'info@lolev.beer',
    },
    address: {
      street: '5247 Butler Street',
      city: 'Pittsburgh',
      state: 'PA',
      zip: '15201',
    },
  },
  zelienople: {
    name: 'Zelienople',
    active: true,
    timezone: 'America/New_York',
    basicInfo: {},
    address: {
      street: '111 South Main Street',
      city: 'Zelienople',
      state: 'PA',
      zip: '16063',
    },
  },
}

// ============ MAIN SYNC ============
async function runSync(
  payload: any,
  stream: StreamController,
  dryRun: boolean,
  collections: CollectionType[]
) {
  const results: Record<string, { imported: number; updated: number; skipped: number; errors: number; imagesAdded?: number }> = {}

  // Get location IDs, create locations if they don't exist
  const locations = await payload.find({ collection: 'locations', limit: 10 })
  const locationMap = new Map<string, string>()
  for (const loc of locations.docs) {
    locationMap.set(loc.slug, loc.id)
  }

  // Ensure required locations exist
  for (const [slug, seedData] of Object.entries(LOCATION_SEED_DATA)) {
    if (!locationMap.has(slug)) {
      if (!dryRun) {
        stream.send('status', { message: `Creating missing location: ${seedData.name}` })
        const newLocation = await payload.create({
          collection: 'locations',
          data: seedData,
        })
        locationMap.set(newLocation.slug, newLocation.id)
        stream.send('status', { message: `Created location: ${seedData.name} (${newLocation.slug})` })
      } else {
        stream.send('status', { message: `Would create missing location: ${seedData.name}` })
        // Use placeholder for dry run
        locationMap.set(slug, 'dry-run-placeholder')
      }
    }
  }

  if (collections.includes('events')) {
    results.events = await syncEvents(payload, stream, dryRun, locationMap)
  }

  if (collections.includes('food')) {
    results.food = await syncFood(payload, stream, dryRun, locationMap)
  }

  if (collections.includes('beers')) {
    results.beers = await syncBeers(payload, stream, dryRun)
  }

  if (collections.includes('menus')) {
    results.menus = await syncMenus(payload, stream, dryRun, locationMap)
  }

  return results
}

export const syncGoogleSheets: PayloadHandler = async (req) => {
  const { payload, user } = req

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url || '', 'http://localhost')
  const dryRun = url.searchParams.get('dryRun') === 'true'
  const collectionsParam = url.searchParams.get('collections') || 'events,food'
  const collections = collectionsParam.split(',').filter(c =>
    ['events', 'food', 'beers', 'menus'].includes(c)
  ) as CollectionType[]

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        send('status', { message: dryRun ? 'Starting preview...' : 'Starting sync...' })

        const results = await runSync(payload, { send }, dryRun, collections)

        send('complete', {
          success: true,
          results,
          dryRun,
        })
      } catch (error: any) {
        send('error', { message: error.message })
        send('complete', { success: false, error: error.message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
