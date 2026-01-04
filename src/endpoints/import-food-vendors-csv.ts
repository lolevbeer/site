import type { PayloadHandler } from 'payload'
import { parse } from 'csv-parse/sync'

export const importFoodVendorsCSV: PayloadHandler = async (req) => {
  const { payload, user } = req

  if (!user || (!user.roles?.includes('admin') && !user.roles?.includes('food-manager'))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await req.formData?.()
    if (!formData) {
      return Response.json({ error: 'No form data' }, { status: 400 })
    }

    const file = formData.get('file') as File | null
    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 })
    }

    const csvContent = await file.text()
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Array<Record<string, string>>

    const results = {
      created: 0,
      skipped: 0,
      errors: 0,
      details: [] as string[],
    }

    for (const record of records) {
      const vendorName = record.vendor?.trim()

      if (!vendorName) {
        results.skipped++
        continue
      }

      // Check if vendor already exists
      const existing = await payload.find({
        collection: 'food-vendors',
        where: { name: { equals: vendorName } },
        limit: 1,
      })

      if (existing.docs.length > 0) {
        results.skipped++
        results.details.push(`Skipped (exists): ${vendorName}`)
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
        results.created++
        results.details.push(`Created: ${vendorName}`)
      } catch (err: any) {
        results.errors++
        results.details.push(`Error: ${vendorName} - ${err.message}`)
      }
    }

    return Response.json({
      success: true,
      total: records.length,
      ...results,
    })
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
