import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'
import type { Location } from '@/src/payload-types'

/** Preserve the formerly implicit selections once; subsequent edits live on Locations. */
export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const locations = await payload.find({
    collection: 'locations',
    pagination: false,
    depth: 0,
    overrideAccess: true,
    req,
  })

  for (const location of locations.docs) {
    const data: Partial<Location> = {}
    for (const type of ['draft', 'cans'] as const) {
      const field = `${type}Menu` as const
      // Preserve both a selected menu and an explicitly cleared selection on retry.
      if (location[field] !== undefined) continue

      const menus = await payload.find({
        collection: 'menus',
        where: {
          location: { equals: location.id },
          type: { equals: type },
          _status: { equals: 'published' },
        },
        sort: '-createdAt', // The default order used by the old first-match lookup.
        limit: 1,
        depth: 0,
        overrideAccess: true,
        req,
      })
      data[field] = menus.docs[0]?.id ?? null
    }

    if (Object.keys(data).length === 0) continue
    await payload.update({
      collection: 'locations',
      id: location.id,
      data,
      depth: 0,
      overrideAccess: true,
      req,
      context: { skipRevalidate: true },
    })
  }
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Additive fields are ignored by the previous app; keep any editor selections.
}
