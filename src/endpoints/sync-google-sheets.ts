/**
 * Payload endpoint to sync from Google Sheets (SSE streaming)
 * Supports: Events, Food, Beers, Menus (Cans/Draft)
 */

import type { PayloadHandler } from 'payload'
import { diffJson } from 'diff'
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

type CollectionType = 'events' | 'food' | 'beers' | 'menus' | 'hours' | 'distributors'

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
  distributors: {
    pa: process.env.GOOGLE_CSV_DISTRIBUTORS_PA || '',
    ny: process.env.GOOGLE_CSV_DISTRIBUTORS_NY || '',
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
const IMAGE_BASE_URL = 'https://lolev.beer/images/beer'

async function checkBeerImageExists(variant: string): Promise<string | null> {
  const imageUrl = `${IMAGE_BASE_URL}/${variant}.png`
  try {
    const response = await fetch(imageUrl, { method: 'HEAD' })
    if (response.ok) {
      return imageUrl
    }
    return null
  } catch {
    return null
  }
}

async function uploadBeerImage(
  payload: any,
  variant: string,
  imageUrl: string,
  stream: StreamController
): Promise<string | null> {
  try {
    // Delete any existing media for this variant
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

    // Fetch the image from the remote URL
    stream.send('status', { message: `Fetching image for ${variant} from ${imageUrl}...` })
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)
    const filename = `${variant}.png`

    stream.send('status', { message: `Image fetched: ${fileBuffer.length} bytes` })

    // Create media document
    const fileData = {
      data: fileBuffer,
      name: filename,
      size: fileBuffer.length,
      mimetype: 'image/png',
    }

    const media = await payload.create({
      collection: 'media',
      data: {
        alt: `${variant} beer can`,
      },
      file: fileData as any,
    })

    stream.send('status', { message: `✅ Uploaded image for ${variant}` })
    return media.id
  } catch (error: any) {
    const errorMsg = error?.message || String(error)
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

      // Check for image at lolev.beer - use the original variant for image lookup
      let imageId: string | undefined = undefined
      const imageUrl = await checkBeerImageExists(beer.variant) || await checkBeerImageExists(slug)

      if (imageUrl) {
        // Check if existing beer already has an image
        const existingBeer = existing.docs[0]
        const hasExistingImage = existingBeer?.image &&
          (typeof existingBeer.image === 'object' ? existingBeer.image.id : existingBeer.image)

        if (!hasExistingImage && !dryRun) {
          // Upload the image
          imageId = await uploadBeerImage(payload, beer.variant, imageUrl, stream) || undefined
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

  // Get all existing menus to check for per-document sheetUrl
  const existingMenus = await payload.find({ collection: 'menus', limit: 100, depth: 1 })
  const menuSheetUrls = new Map<string, string>()
  for (const menu of existingMenus.docs) {
    if (menu.sheetUrl) {
      menuSheetUrls.set(menu.url, menu.sheetUrl)
    }
  }

  for (const menuType of ['cans', 'draft'] as const) {
    const menuConfig = SHEETS_CONFIG.menus[menuType]

    for (const [locationSlug, envUrl] of Object.entries(menuConfig)) {
      const menuUrl = `${locationSlug}-${menuType}`
      // Prefer per-document sheetUrl, fall back to environment variable
      const url = menuSheetUrls.get(menuUrl) || envUrl
      if (!url) continue

      const locationId = locationMap.get(locationSlug)
      if (!locationId) {
        stream.send('error', { message: `Location "${locationSlug}" not found` })
        continue
      }

      const sourceNote = menuSheetUrls.get(menuUrl) ? '(from document)' : '(from env)'
      stream.send('status', { message: `Fetching ${locationSlug} ${menuType} menu ${sourceNote}...` })

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

// ============ SYNC HOURS ============
/**
 * Get timezone offset in hours for a given IANA timezone
 * Returns offset to ADD to local time to get UTC (e.g., EST = +5, EDT = +4)
 */
function getTimezoneOffsetHours(timezone: string): number {
  // For EST/EDT (America/New_York), we need to determine if DST is in effect
  // Use a reference date to get the offset
  const now = new Date()
  const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }))
  const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
  return (utcDate.getTime() - tzDate.getTime()) / (1000 * 60 * 60)
}

/**
 * Parse time string (e.g., "4:00 PM", "16:00", "4pm", "noon", "midnight") to ISO date string for Payload time-only field
 * Times are interpreted as being in the specified timezone
 */
function parseTimeToISO(timeStr: string, timezone: string = 'America/New_York'): string | null {
  if (!timeStr || timeStr.toLowerCase() === 'closed') return null

  // Clean up the string
  const cleaned = timeStr.trim().toLowerCase()

  let hours = 0
  let minutes = 0

  // Handle special keywords
  if (cleaned === 'noon' || cleaned === '12noon' || cleaned === '12 noon') {
    hours = 12
    minutes = 0
  } else if (cleaned === 'midnight' || cleaned === '12am' || cleaned === '12 am') {
    hours = 0
    minutes = 0
  } else {
    // Try parsing "4:00 PM" or "4:00pm" or "4pm" format
    const ampmMatch = cleaned.match(/^(\d{1,2}):?(\d{2})?\s*(am|pm)?$/i)
    if (ampmMatch) {
      hours = parseInt(ampmMatch[1])
      minutes = ampmMatch[2] ? parseInt(ampmMatch[2]) : 0
      const isPM = ampmMatch[3]?.toLowerCase() === 'pm'

      if (isPM && hours !== 12) hours += 12
      if (!isPM && hours === 12) hours = 0
    } else {
      // Try 24-hour format "16:00"
      const militaryMatch = cleaned.match(/^(\d{1,2}):(\d{2})$/)
      if (militaryMatch) {
        hours = parseInt(militaryMatch[1])
        minutes = parseInt(militaryMatch[2])
      } else {
        return null
      }
    }
  }

  // Get timezone offset and adjust hours to UTC
  const offsetHours = getTimezoneOffsetHours(timezone)

  // Create date with local time, then adjust for timezone
  // We store as UTC but the time represents the local timezone
  const date = new Date('2000-01-01T00:00:00Z')
  date.setUTCHours(hours + offsetHours, minutes, 0, 0)
  return date.toISOString()
}

async function syncHours(payload: any, stream: StreamController, dryRun: boolean) {
  const results = { imported: 0, updated: 0, skipped: 0, errors: 0 }

  // Get all locations that have a hoursSheetUrl
  const locations = await payload.find({ collection: 'locations', limit: 50 })

  for (const location of locations.docs) {
    const sheetUrl = location.hoursSheetUrl
    if (!sheetUrl) {
      stream.send('status', { message: `${location.name}: No hours sheet URL configured, skipping` })
      continue
    }

    // Get location timezone (default to America/New_York)
    const timezone = location.timezone || 'America/New_York'
    stream.send('status', { message: `Fetching hours for ${location.name} (${timezone})...` })

    try {
      const rows = await fetchCSV(sheetUrl)

      if (rows.length === 0) {
        stream.send('error', { message: `${location.name}: No data in hours sheet` })
        results.errors++
        continue
      }

      // Expected CSV format: day, open, close (or: day, hours with "4pm - 10pm" format)
      const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      const hoursUpdate: Record<string, { open?: string | null; close?: string | null }> = {}
      const changes: FieldChange[] = []

      for (const row of rows) {
        // Normalize day name - check common column names
        const dayRaw = (row.day || row.dayofweek || row.dayname || row.name || '').toLowerCase().trim()
        const day = dayNames.find(d => dayRaw.startsWith(d.substring(0, 3)))

        if (!day) continue

        let openTime: string | null = null
        let closeTime: string | null = null

        // Check for separate open/close columns
        if (row.open !== undefined && row.close !== undefined) {
          openTime = parseTimeToISO(row.open, timezone)
          closeTime = parseTimeToISO(row.close, timezone)
        }
        // Check for combined "hours" column like "4pm - 10pm"
        else if (row.hours) {
          const hoursParts = row.hours.split(/[-–]/).map((s: string) => s.trim())
          if (hoursParts.length === 2) {
            openTime = parseTimeToISO(hoursParts[0], timezone)
            closeTime = parseTimeToISO(hoursParts[1], timezone)
          } else if (row.hours.toLowerCase() === 'closed') {
            openTime = null
            closeTime = null
          }
        }

        hoursUpdate[day] = { open: openTime, close: closeTime }

        // Compare with existing
        const existingDay = location[day] as { open?: string; close?: string } | undefined
        const existingOpen = existingDay?.open || null
        const existingClose = existingDay?.close || null

        if (existingOpen !== openTime || existingClose !== closeTime) {
          changes.push({
            field: day,
            from: existingOpen && existingClose ? `${existingOpen} - ${existingClose}` : 'not set',
            to: openTime && closeTime ? `${openTime} - ${closeTime}` : 'closed/not set',
          })
        }
      }

      if (changes.length === 0) {
        results.skipped++
        stream.send('hours', {
          action: 'unchanged',
          location: location.name,
        })
        continue
      }

      if (!dryRun) {
        await payload.update({
          collection: 'locations',
          id: location.id,
          data: hoursUpdate,
        })
      }

      results.updated++
      stream.send('hours', {
        action: dryRun ? 'would update' : 'updated',
        location: location.name,
        changes,
      })

    } catch (error: any) {
      stream.send('error', { message: `Error syncing ${location.name} hours: ${error.message}` })
      results.errors++
    }
  }

  return results
}

// ============ SYNC DISTRIBUTORS ============
interface GeoFeature {
  type: 'Feature'
  geometry: {
    type: 'Point'
    coordinates: [number, number] // [longitude, latitude]
  }
  properties: {
    id: number
    Name: string
    address: string
    customerType: string
  }
}

interface GeoJSON {
  type: 'FeatureCollection'
  features: GeoFeature[]
}

// Load GeoJSON via HTTP (filesystem not available on Vercel serverless)
async function loadGeoJSON(region: string, baseUrl: string): Promise<{ data: GeoJSON | null; error?: string; url?: string }> {
  const url = `${baseUrl}/${region.toLowerCase()}_geo_data.json`
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return { data: null, error: `HTTP ${response.status}: ${response.statusText}`, url }
    }
    return { data: (await response.json()) as GeoJSON, url }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : String(err), url }
  }
}

// Normalize customer type to valid enum values
function normalizeCustomerType(type: string): 'Retail' | 'On Premise' | 'Home-D' {
  const typeLower = type.toLowerCase()
  if (typeLower.includes('bar') || typeLower.includes('restaurant') || typeLower.includes('hotel') ||
      typeLower.includes('brewery') || typeLower.includes('catering') || typeLower.includes('six pack')) {
    return 'On Premise'
  }
  if (typeLower.includes('home') || typeLower.includes('delivery') || typeLower === 'home-d') {
    return 'Home-D'
  }
  // Retail, Liquor Store, Grocery, Supplier, etc.
  return 'Retail'
}

// Parse address into components
function parseAddress(fullAddress: string): { street: string; city?: string; state?: string; zip?: string } {
  // Format: "2756 W 12TH ST, ERIE, PA, 16505"
  const parts = fullAddress.split(',').map(p => p.trim())
  if (parts.length >= 4) {
    return {
      street: parts[0],
      city: parts[1],
      state: parts[2],
      zip: parts[3],
    }
  } else if (parts.length === 3) {
    // "Street, City, State Zip"
    const stateZip = parts[2].split(' ')
    return {
      street: parts[0],
      city: parts[1],
      state: stateZip[0],
      zip: stateZip[1],
    }
  }
  return { street: fullAddress }
}

async function syncDistributors(payload: any, stream: StreamController, dryRun: boolean, baseUrl: string) {
  const results = { imported: 0, updated: 0, skipped: 0, errors: 0 }
  const regions = ['pa', 'ny']

  for (const region of regions) {
    stream.send('status', { message: `Loading ${region.toUpperCase()} distributors from geo data...` })

    const { data: geoData, error, url } = await loadGeoJSON(region, baseUrl)
    if (!geoData) {
      stream.send('error', { message: `Could not load ${region}_geo_data.json - ${error || 'unknown error'} (URL: ${url})` })
      results.errors++
      continue
    }

    const features = geoData.features.filter(f => f.properties.Name && f.geometry.coordinates)
    stream.send('status', { message: `Processing ${features.length} ${region.toUpperCase()} distributors...` })

    for (const feature of features) {
      const { Name, address, customerType } = feature.properties
      const [lng, lat] = feature.geometry.coordinates

      if (!lng || !lat || isNaN(lng) || isNaN(lat)) {
        stream.send('error', { message: `Invalid coordinates for "${Name}"` })
        results.skipped++
        continue
      }

      // Check for existing distributor by name and region
      const existing = await payload.find({
        collection: 'distributors',
        where: {
          and: [
            { name: { equals: Name } },
            { region: { equals: region.toUpperCase() } },
          ],
        },
        limit: 1,
      })

      const normalizedType = normalizeCustomerType(customerType)
      const addressParts = parseAddress(address)

      const distributorData = {
        name: Name,
        address: addressParts.street,
        city: addressParts.city,
        state: addressParts.state || region.toUpperCase(),
        zip: addressParts.zip,
        customerType: normalizedType,
        region: region.toUpperCase(),
        location: [lng, lat], // Point field: [longitude, latitude]
        active: true,
        source: 'google-sheets' as const,
      }

      if (existing.docs.length > 0) {
        const existingDoc = existing.docs[0]
        const existingLocation = existingDoc.location || [0, 0]
        const incomingForCompare = {
          address: addressParts.street || null,
          customerType: normalizedType,
          lat,
          lng,
        }
        const existingForCompare = {
          address: existingDoc.address || null,
          customerType: existingDoc.customerType,
          lat: existingLocation[1],
          lng: existingLocation[0],
        }
        const changes = computeChanges(existingForCompare, incomingForCompare, ['address', 'customerType', 'lat', 'lng'])

        if (changes.length === 0) {
          results.skipped++
          continue
        }

        if (!dryRun) {
          await payload.update({ collection: 'distributors', id: existingDoc.id, data: distributorData })
        }
        results.updated++
        stream.send('distributor', {
          action: dryRun ? 'would update' : 'updated',
          name: Name,
          region: region.toUpperCase(),
          changes,
        })
        continue
      }

      if (!dryRun) {
        await payload.create({ collection: 'distributors', data: distributorData })
      }
      results.imported++
      stream.send('distributor', {
        action: dryRun ? 'would import' : 'imported',
        name: Name,
        region: region.toUpperCase(),
        customerType: normalizedType,
      })
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
  collections: CollectionType[],
  baseUrl: string
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

  if (collections.includes('hours')) {
    results.hours = await syncHours(payload, stream, dryRun)
  }

  if (collections.includes('distributors')) {
    results.distributors = await syncDistributors(payload, stream, dryRun, baseUrl)
  }

  return results
}

export const syncGoogleSheets: PayloadHandler = async (req) => {
  const url = new URL(req.url || '', 'http://localhost')
  const dryRun = url.searchParams.get('dryRun') === 'true'
  const collectionsParam = url.searchParams.get('collections') || 'events,food'
  const collections = collectionsParam.split(',').filter(c =>
    ['events', 'food', 'beers', 'menus', 'hours', 'distributors'].includes(c)
  ) as CollectionType[]

  // Get base URL from request headers
  const host = req.headers.get('host') || 'localhost:3000'
  const protocol = req.headers.get('x-forwarded-proto') || 'http'
  const baseUrl = `${protocol}://${host}`

  // Use getPayloadHMR for file upload support
  const { getPayloadHMR } = await import('@payloadcms/next/utilities')
  const payload = await getPayloadHMR({ config: (await import('@payload-config')).default })

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        send('status', { message: dryRun ? 'Starting preview...' : 'Starting sync...' })

        const results = await runSync(payload, { send }, dryRun, collections, baseUrl)

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
