/**
 * Payload 4 beta.0 stores a Media doc's generated images under `variants`
 * (formerly `sizes`). Renames the stored field with Payload's predefined
 * helper, which `$rename`s each doc, re-keys indexes, skips docs already
 * renamed, and refuses to run if a collection has data under both keys.
 *
 * `down` throws: renaming back is not enough. Media uploaded on beta lives under an
 * `_objectKey` folder with an `original` group, and canary.37 builds URLs
 * without either, so those images would 404. Recovery is roll-forward (see
 * src/migrations/recovery/).
 */
import type { MigrateUpArgs } from '@payloadcms/db-mongodb'
import { migrateSizesToVariants } from '@payloadcms/db-mongodb/migration-utils'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  await migrateSizesToVariants({ payload, req })
}

export async function down(): Promise<void> {
  throw new Error('media_sizes_to_variants is roll-forward only; see src/migrations/recovery/.')
}
