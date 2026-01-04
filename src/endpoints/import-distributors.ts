import type { PayloadHandler } from 'payload'

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

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
}

function parseAddress(combined: string, defaultState: string): ParsedAddress | null {
  // Try standard format first: "112 W. 15th St., Cincinnati, OH 45202"
  const match = combined.match(/^(.+),\s*(.+),\s*([A-Za-z]{2,4})\s*(\d{4,6}(?:-\d{4})?)$/)
  if (match) {
    return {
      street: match[1].trim(),
      city: match[2].trim(),
      state: defaultState,
      zip: match[4].length === 5 ? match[4] : '',
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

  // Last resort: split by commas
  const parts = combined.split(',').map((p) => p.trim())
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1]
    const zipMatch = lastPart.match(/(\d{5})/)
    const cityPart =
      parts.length >= 3
        ? parts[parts.length - 2]
        : parts[parts.length - 1].replace(/[A-Z]{2}\s*\d+/, '').trim()

    return {
      street: parts
        .slice(0, -1)
        .join(', ')
        .replace(/,\s*$/, ''),
      city: cityPart.replace(/[A-Za-z]{2,4}\s*\d*$/, '').trim() || defaultState,
      state: defaultState,
      zip: zipMatch ? zipMatch[1] : '',
    }
  }

  return null
}

async function geocodeAddress(address: string): Promise<[number, number] | null> {
  const encoded = encodeURIComponent(address)
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=1`

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'LolevBeer-Import/1.0' },
    })

    if (!response.ok) return null

    const data = await response.json()
    if (data.length === 0) return null

    return [parseFloat(data[0].lon), parseFloat(data[0].lat)]
  } catch {
    return null
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface FetchResult {
  rows: DistributorRow[]
  error?: string
}

async function fetchDistributors(url: string): Promise<FetchResult> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return { rows: [], error: `HTTP ${response.status}: ${response.statusText}` }
    }

    const data = await response.json()
    const rows = data?.Export?.Table?.Row || []

    if (rows.length === 0) {
      return { rows: [], error: 'No rows found in Export.Table.Row' }
    }

    const filtered = rows
      .filter((row: DistributorRow) => row.AddressCityStateZip) // Filter out null addresses (like "Total" row)
      .map((row: DistributorRow) => ({
        ...row,
        CustomerName: decodeHtmlEntities(row.CustomerName),
      }))
      .filter(
        (row: DistributorRow) =>
          !row.CustomerName.toLowerCase().includes('fifo') &&
          !row.CustomerName.toLowerCase().includes('adjustment') &&
          !row.CustomerName.toLowerCase().includes('total') &&
          !row.AddressCityStateZip.toLowerCase().includes('distributor address'),
      )

    return { rows: filtered }
  } catch (error: any) {
    return { rows: [], error: error.message || 'Unknown fetch error' }
  }
}

// Default coordinates for each region
const DEFAULT_COORDS: Record<string, [number, number]> = {
  PA: [-79.9959, 40.4406], // Pittsburgh
  OH: [-82.9988, 39.9612], // Columbus
}

export const importDistributors: PayloadHandler = async (req) => {
  const { payload, user } = req

  if (!user || !user.roles?.includes('admin')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url || '', 'http://localhost')
  const region = (url.searchParams.get('region') || 'oh').toLowerCase()

  if (region !== 'pa' && region !== 'oh') {
    return Response.json({ error: 'Invalid region. Use pa or oh.' }, { status: 400 })
  }

  const regionUpper = region.toUpperCase() as 'PA' | 'OH'

  // Get URL from site-content
  const siteContent = await payload.findGlobal({ slug: 'site-content' })
  const jsonUrl = region === 'pa' ? (siteContent as any).distributorPaUrl : (siteContent as any).distributorOhUrl

  if (!jsonUrl) {
    return Response.json({ error: `No URL configured for ${regionUpper}` }, { status: 400 })
  }

  const { rows, error: fetchError } = await fetchDistributors(jsonUrl)

  if (fetchError || rows.length === 0) {
    return Response.json({
      error: fetchError || 'No data fetched from URL',
      details: [`Fetch error: ${fetchError || 'Empty response'}`],
      imported: 0,
      skipped: 0,
      errors: 1,
    }, { status: 400 })
  }

  // Stream progress updates
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      let imported = 0,
        skipped = 0,
        errors = 0
      const details: string[] = []
      const total = rows.length

      send('progress', { current: 0, total, name: 'Starting...', percent: 0 })

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const percent = Math.round(((i + 1) / total) * 100)

        send('progress', { current: i + 1, total, name: row.CustomerName, percent })

        const parsed = parseAddress(row.AddressCityStateZip, regionUpper)
        if (!parsed) {
          const msg = `Error: Could not parse address for "${row.CustomerName}"`
          details.push(msg)
          send('item', { type: 'error', message: msg })
          errors++
          continue
        }

        // Check for existing
        const existing = await payload.find({
          collection: 'distributors',
          where: { name: { equals: row.CustomerName } },
          limit: 1,
        })

        if (existing.docs.length > 0) {
          const msg = `Skipped: "${row.CustomerName}" already exists`
          details.push(msg)
          send('item', { type: 'skip', message: msg })
          skipped++
          continue
        }

        // Geocode
        const fullAddress = `${parsed.street}, ${parsed.city}, ${parsed.state} ${parsed.zip}`.trim()
        const coords = await geocodeAddress(fullAddress)
        const location = coords || DEFAULT_COORDS[regionUpper]

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
              region: regionUpper,
              location,
              active: true,
            },
          })
          const msg = `Imported: ${row.CustomerName}`
          details.push(msg)
          send('item', { type: 'success', message: msg })
          imported++
        } catch (error: any) {
          const msg = `Error: Failed to import "${row.CustomerName}" - ${error.message}`
          details.push(msg)
          send('item', { type: 'error', message: msg })
          errors++
        }

        // Rate limit for Nominatim
        await sleep(1100)
      }

      send('complete', { imported, skipped, errors, details })
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
